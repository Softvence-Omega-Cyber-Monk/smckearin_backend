import { EventsEnum } from '@/common/enum/queue-events.enum';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ConversationScope,
  MessageDeliveryStatus,
  Prisma,
  UserRole,
} from '@prisma';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import {
  ConversationType,
  InitOrLoadSingleConversationDto,
} from '../dto/conversation.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  ChatParticipantType,
  ConversationParticipant,
  ConversationWithRelations,
  FormattedMessage,
  ReadByParticipant,
  SingleConversationResponse,
} from '../types/single-conversation.types';

@Injectable()
export class ConversationSingleQueryService {
  private readonly logger = new Logger(ConversationSingleQueryService.name);

  // Private helper for conversation include
  private get conversationInclude() {
    return {
      initiator: {
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          profilePictureUrl: true,
          shelterAdminOfId: true,
          managerOfId: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          profilePictureUrl: true,
          shelterAdminOfId: true,
          managerOfId: true,
        },
      },
      shelter: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          logoId: true,
          shelterAdmins: { select: { id: true } },
          managers: { select: { id: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
              profilePictureUrl: true,
              shelterAdminOfId: true,
              managerOfId: true,
            },
          },
          file: {
            select: {
              id: true,
              url: true,
              fileType: true,
              mimeType: true,
              size: true,
            },
          },
          statuses: {
            select: {
              userId: true,
              status: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  profilePictureUrl: true,
                  shelterAdminOfId: true,
                  managerOfId: true,
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.PrivateConversationInclude;
  }

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @SocketSafe()
  async loadSingleConversation(
    client: Socket,
    dto: InitOrLoadSingleConversationDto,
  ) {
    const userId = client.data.userId;
    const result = await this.getSingleConversationInternal(userId, dto);

    client.emit(EventsEnum.CONVERSATION_RESPONSE, result);
    return result;
  }

  /** Core logic for loading a single conversation, used by both REST and Socket */
  async getSingleConversationInternal(
    userId: string,
    dto: InitOrLoadSingleConversationDto,
  ) {
    const { id: targetId, type, page = 1, limit = 50 } = dto;

    this.logger.debug(
      `Loading/Creating conversation for user ${userId} with target ${targetId} type ${type}`,
    );

    // Get current user info with shelter association
    const currentUser = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        profilePictureId: true,
        profilePictureUrl: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const userShelterId =
      currentUser.shelterAdminOfId ?? currentUser.managerOfId ?? null;

    // Determine target user role for permission check (if not chatting with a shelter or specific adoption)
    let targetUser: { id: string; role: UserRole } | null = null;
    if (
      type === ConversationType.VET ||
      type === ConversationType.DRIVER ||
      type === ConversationType.FOSTER ||
      type === ConversationType.ADOPTER
    ) {
      const actualTarget = await this.prisma.client.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true },
      });
      if (!actualTarget) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Target user not found');
      }
      targetUser = actualTarget;
    }

    // Role-based permission enforcement
    this.validateChatPermissions(currentUser, targetUser, type);

    let conversation: ConversationWithRelations;

    // Find or create conversation based on type
    if (type === ConversationType.SHELTER) {
      conversation = await this.findOrCreateShelterConversation(
        userId,
        targetId,
      );
    } else if (type === ConversationType.ADOPTION) {
      conversation = await this.findOrCreateAdoptionConversation(
        userId,
        targetId,
      );
    } else if (
      type === ConversationType.VET ||
      type === ConversationType.DRIVER ||
      type === ConversationType.FOSTER ||
      type === ConversationType.ADOPTER
    ) {
      conversation = await this.findOrCreateUserConversation(
        userId,
        targetId,
        userShelterId,
      );
    } else {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Invalid conversation type: ${type}`,
      );
    }

    // Sync Read Status (Mark unseen messages as SEEN)
    await this.markMessagesAsSeen(userId, conversation.id);

    // Format the response
    const response = await this.formatConversationResponse(
      conversation,
      userId,
      userShelterId,
      page,
      limit,
    );

    return {
      ...response,
      conversationId: conversation.id,
      message: 'Conversation loaded successfully',
    };
  }

  /** Find or create conversation with a SHELTER */
  private async findOrCreateShelterConversation(
    userId: string,
    shelterId: string,
  ): Promise<ConversationWithRelations> {
    // Find existing conversation
    let conversation = await this.prisma.client.privateConversation.findFirst({
      where: {
        chatScope: ConversationScope.MAIN,
        shelterId: shelterId,
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      include: this.conversationInclude,
    });

    // Create if not exists
    if (!conversation) {
      this.logger.debug(`Creating new conversation with shelter ${shelterId}`);
      conversation = await this.prisma.client.privateConversation.create({
        data: {
          initiatorId: userId,
          shelterId: shelterId,
          chatScope: ConversationScope.MAIN,
          // receiverId is null when chatting with a shelter
        },
        include: this.conversationInclude,
      });
    }

    return conversation as ConversationWithRelations;
  }

  /** Find or create conversation for a specific ADOPTION listing */
  private async findOrCreateAdoptionConversation(
    userId: string,
    adoptionId: string,
  ): Promise<ConversationWithRelations> {
    // 1. Get adoption details to find the shelter
    const adoption = await this.prisma.client.adoption.findUniqueOrThrow({
      where: { id: adoptionId },
      select: { shelterId: true },
    });

    // 2. Find existing conversation with this user, shelter, and adoption ID
    let conversation = await this.prisma.client.privateConversation.findFirst({
      where: {
        chatScope: ConversationScope.ADOPTION,
        shelterId: adoption.shelterId,
        adoptionId: adoptionId,
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      include: {
        ...this.conversationInclude,
        adoption: {
          include: { animal: true },
        },
      },
    });

    // 3. Create if not exists
    if (!conversation) {
      this.logger.debug(
        `Creating new adoption conversation for adoption ${adoptionId}`,
      );
      conversation = await this.prisma.client.privateConversation.create({
        data: {
          initiatorId: userId,
          shelterId: adoption.shelterId,
          adoptionId: adoptionId,
          chatScope: ConversationScope.ADOPTION,
        },
        include: {
          ...this.conversationInclude,
          adoption: {
            include: { animal: true },
          },
        },
      });
    }

    return conversation as ConversationWithRelations;
  }

  /** Find or create conversation with a USER (VET or DRIVER) */
  private async findOrCreateUserConversation(
    userId: string,
    targetUserId: string,
    userShelterId: string | null,
  ): Promise<ConversationWithRelations> {
    // If user is from a shelter, conversation should be shelter-based
    if (userShelterId) {
      // Find shelter-based conversation
      let conversation = await this.prisma.client.privateConversation.findFirst(
        {
          where: {
            chatScope: ConversationScope.MAIN,
            shelterId: userShelterId,
            OR: [{ initiatorId: targetUserId }, { receiverId: targetUserId }],
          },
          include: this.conversationInclude,
        },
      );

      // Create if not exists
      if (!conversation) {
        this.logger.debug(
          `Creating new shelter conversation: shelter ${userShelterId} with user ${targetUserId}`,
        );
        conversation = await this.prisma.client.privateConversation.create({
          data: {
            initiatorId: userId,
            receiverId: targetUserId,
            shelterId: userShelterId,
            chatScope: ConversationScope.MAIN,
          },
          include: this.conversationInclude,
        });
      }

      return conversation as ConversationWithRelations;
    } else {
      // Individual user to user conversation (no shelter)
      let conversation = await this.prisma.client.privateConversation.findFirst(
        {
          where: {
            chatScope: ConversationScope.MAIN,
            shelterId: null,
            OR: [
              { initiatorId: userId, receiverId: targetUserId },
              { initiatorId: targetUserId, receiverId: userId },
            ],
          },
          include: this.conversationInclude,
        },
      );

      if (!conversation) {
        this.logger.debug(
          `Creating new individual conversation between ${userId} and ${targetUserId}`,
        );
        conversation = await this.prisma.client.privateConversation.create({
          data: {
            initiatorId: userId,
            receiverId: targetUserId,
            chatScope: ConversationScope.MAIN,
          },
          include: this.conversationInclude,
        });
      }

      return conversation as ConversationWithRelations;
    }
  }

  /** Mark all unseen messages in this conversation for this user as SEEN */
  private async markMessagesAsSeen(userId: string, conversationId: string) {
    const unseenMessages = await this.prisma.client.privateMessage.findMany({
      where: {
        conversationId: conversationId,
        statuses: {
          some: {
            userId: userId,
            status: { not: MessageDeliveryStatus.SEEN },
          },
        },
      },
      select: { id: true },
    });

    for (const message of unseenMessages) {
      await this.prisma.client.privateMessageStatus.upsert({
        where: {
          messageId_userId: {
            messageId: message.id,
            userId: userId,
          },
        },
        update: {
          status: MessageDeliveryStatus.SEEN,
        },
        create: {
          userId: userId,
          messageId: message.id,
          status: MessageDeliveryStatus.SEEN,
        },
      });
    }
  }

  /** Format conversation response with proper participant display logic */
  private async formatConversationResponse(
    conversation: ConversationWithRelations,
    userId: string,
    userShelterId: string | null,
    page: number,
    limit: number,
  ): Promise<TPaginatedResponse<SingleConversationResponse>> {
    // Determine the "other" participant based on context
    const participant = this.getConversationParticipant(
      conversation,
      userId,
      userShelterId,
    );

    // Format messages with pagination — newest first, reversed to show chronological order
    const totalMessages = conversation.messages.length;
    const skip = (page - 1) * limit;
    // Messages are sorted desc (newest first), so page 1 = most recent messages
    const paginatedMessages = conversation.messages
      .slice(skip, skip + limit)
      .reverse(); // Reverse to show oldest→newest within the page

    const formattedMessages: FormattedMessage[] = paginatedMessages.map(
      (msg: ConversationWithRelations['messages'][number]) =>
        this.formatMessage(msg, userId),
    );

    const response: SingleConversationResponse = {
      conversationId: conversation.id,
      type:
        conversation.chatScope === ConversationScope.ADOPTION
          ? ConversationType.ADOPTION
          : participant?.role === 'VETERINARIAN'
            ? ConversationType.VET
            : participant?.role === 'DRIVER'
              ? ConversationType.DRIVER
              : participant?.role === 'FOSTER'
                ? ConversationType.FOSTER
                : participant?.role === 'ADOPTER'
                  ? ConversationType.ADOPTER
                  : ConversationType.SHELTER,
      participant,
      adoption: conversation.adoption
        ? {
            id: conversation.adoption.id,
            name: conversation.adoption.animal.name,
            breed: conversation.adoption.animal.breed,
            imageUrl: conversation.adoption.animal.imageUrl,
          }
        : undefined,
      messages: formattedMessages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    return successPaginatedResponse([response], {
      page,
      limit,
      total: totalMessages,
    });
  }

  /** Get single participant with proper display logic for team-based shelters */
  private getConversationParticipant(
    conversation: ConversationWithRelations,
    userId: string,
    userShelterId: string | null,
  ): ConversationParticipant {
    // If conversation involves a shelter
    if (conversation.shelterId) {
      // If current user is FROM the shelter, show the other user (who is NOT shelter staff)
      if (userShelterId === conversation.shelterId) {
        // Staff identifying logic: check if initiator or receiver is a member of THIS shelter
        const initiatorIsStaff =
          conversation.initiator?.shelterAdminOfId === conversation.shelterId ||
          conversation.initiator?.managerOfId === conversation.shelterId;

        const otherUser = initiatorIsStaff
          ? conversation.receiver
          : conversation.initiator;

        if (otherUser) {
          return {
            id: otherUser.id,
            name: otherUser.name,
            role: otherUser.role,
            avatarUrl:
              otherUser.profilePictureUrl ||
              this.getDefaultAvatar(otherUser.name),
            isActive: this.chatGateway.isOnline(otherUser.id),
            type:
              otherUser.role === 'VETERINARIAN'
                ? ChatParticipantType.VET
                : otherUser.role === 'DRIVER'
                  ? ChatParticipantType.DRIVER
                  : otherUser.role === 'FOSTER'
                    ? ChatParticipantType.FOSTER
                    : otherUser.role === 'ADOPTER'
                      ? ChatParticipantType.ADOPTER
                      : ChatParticipantType.USER,
          };
        }
      } else {
        // Current user is NOT from the shelter, show the shelter
        if (conversation.shelter) {
          // Check if ANY member (manager or admin) is online
          const teamIds = [
            ...(conversation.shelter.shelterAdmins?.map((a) => a.id) || []),
            ...(conversation.shelter.managers?.map((m) => m.id) || []),
          ];
          const isTeamActive = teamIds.some((id: string) =>
            this.chatGateway.isOnline(id),
          );

          return {
            id: conversation.shelter.id,
            name: conversation.shelter.name,
            role: 'SHELTER_ADMIN',
            avatarUrl:
              conversation.shelter.logoUrl ||
              this.getDefaultAvatar(conversation.shelter.name),
            isActive: isTeamActive,
            type: ChatParticipantType.SHELTER,
          };
        }
      }
    } else {
      // No shelter involved, show the other user
      let otherUser =
        conversation.initiator?.id === userId
          ? conversation.receiver
          : conversation.initiator;

      // For Adoption scope specifically, if we are shelter staff and otherUser is still null or staff, try harder
      if (
        conversation.chatScope === ConversationScope.ADOPTION &&
        userShelterId
      ) {
        const staffIds = [
          ...(conversation.shelter?.shelterAdmins?.map(
            (a: { id: string }) => a.id,
          ) || []),
          ...(conversation.shelter?.managers?.map(
            (m: { id: string }) => m.id,
          ) || []),
        ];

        if (!otherUser || staffIds.includes(otherUser.id)) {
          otherUser =
            conversation.initiator &&
            !staffIds.includes(conversation.initiator.id)
              ? conversation.initiator
              : conversation.receiver;
        }
      }

      if (otherUser) {
        return {
          id: otherUser.id,
          name: otherUser.name,
          role: otherUser.role,
          avatarUrl:
            otherUser.profilePictureUrl ||
            this.getDefaultAvatar(otherUser.name),
          isActive: this.chatGateway.isOnline(otherUser.id),
          type:
            otherUser.role === 'VETERINARIAN'
              ? ChatParticipantType.VET
              : otherUser.role === 'DRIVER'
                ? ChatParticipantType.DRIVER
                : otherUser.role === 'FOSTER'
                  ? ChatParticipantType.FOSTER
                  : otherUser.role === 'ADOPTER'
                    ? ChatParticipantType.ADOPTER
                    : ChatParticipantType.USER,
        };
      }
    }

    throw new Error('Could not determine conversation participant');
  }

  /** Format individual message */
  private formatMessage(
    msg: ConversationWithRelations['messages'][number],
    userId: string,
  ): FormattedMessage {
    const isMine = msg.senderId === userId;

    // Determine sender type
    const senderShelterId =
      msg.sender?.shelterAdminOfId || msg.sender?.managerOfId;
    const isFromShelter = !!senderShelterId;
    const isFromVet = msg.sender?.role === 'VETERINARIAN';
    const isFromDriver = msg.sender?.role === 'DRIVER';
    const isFromFoster = msg.sender?.role === 'FOSTER';
    const isFromAdopter = msg.sender?.role === 'ADOPTER';

    // Format readBy
    const readBy: ReadByParticipant[] = msg.statuses
      .filter(
        (s) => s.userId !== userId && s.status === MessageDeliveryStatus.SEEN,
      )
      .map((s) => {
        const reader = s.user;
        const readerShelterId = reader?.shelterAdminOfId || reader?.managerOfId;

        // Logic to determine type and name
        // Case 1: Reader is a Vet
        if (reader.role === 'VETERINARIAN') {
          return {
            id: reader.id,
            name: reader.name,
            type: ChatParticipantType.VET,
          };
        }
        // Case 2: Reader is a Driver
        if (reader.role === 'DRIVER') {
          return {
            id: reader.id,
            name: reader.name,
            type: ChatParticipantType.DRIVER,
          };
        }
        // Case 2.1: Reader is a Foster
        if (reader.role === 'FOSTER') {
          return {
            id: reader.id,
            name: reader.name,
            type: ChatParticipantType.FOSTER,
          };
        }
        if (reader.role === 'ADOPTER') {
          return {
            id: reader.id,
            name: reader.name,
            type: ChatParticipantType.ADOPTER,
          };
        }

        // Case 3: Reader is Shelter Staff (Admin/Manager)
        if (readerShelterId) {
          return {
            id: readerShelterId, // Group by Shelter ID
            name: 'Shelter',
            type: ChatParticipantType.SHELTER,
          };
        }

        // Case 4: Regular User or fallback
        return {
          id: reader.id,
          name: reader.name,
          type: ChatParticipantType.USER,
        };
      })
      // Deduplicate by ID and type
      .filter(
        (v, i, a) =>
          a.findIndex((t) => t.id === v.id && t.type === v.type) === i,
      );

    return {
      id: msg.id,
      content: msg.content ?? '', // ensure string for content
      type: msg.type,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        role: msg.sender.role,
        avatarUrl:
          msg.sender.profilePictureUrl ||
          this.getDefaultAvatar(msg.sender.name),
      },
      fileUrl: msg.file?.url ?? null,
      file: msg.file ?? null,
      isMine,
      isFromShelter,
      isFromDriver,
      isFromVet,
      isFromFoster,
      isFromAdopter,
      isRead: readBy.length > 0 && readBy.some((r) => r.id !== msg.senderId),
      readBy: readBy,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };
  }

  /** Enforce chat rules based on user roles */
  private validateChatPermissions(
    user: { id: string; role: UserRole },
    targetUser: { id: string; role: UserRole } | null,
    type: ConversationType,
  ) {
    // Admins can do anything
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // 1. Shelter chat to Driver and foster
    if (
      user.role === UserRole.SHELTER_ADMIN ||
      user.role === UserRole.MANAGER
    ) {
      // Can chat with everyone except maybe random users who are not in the list
      // But based on the requirement, we explicitly allow Driver and Foster.
      // Adopters are also allowed via SHELTER or ADOPTION types.
      return;
    }

    // 2. Foster chat to Shelter and Driver
    if (user.role === UserRole.FOSTER) {
      if (
        type === ConversationType.SHELTER ||
        type === ConversationType.ADOPTION
      ) {
        return;
      }
      if (
        type === ConversationType.DRIVER &&
        targetUser?.role === UserRole.DRIVER
      ) {
        return;
      }
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Fosters can only chat with shelters and drivers',
      );
    }

    // 3. Driver chat to Shelter and Foster (implied by bidirectional)
    if (user.role === UserRole.DRIVER) {
      if (
        type === ConversationType.SHELTER ||
        type === ConversationType.ADOPTION
      ) {
        return;
      }
      if (
        type === ConversationType.FOSTER &&
        targetUser?.role === UserRole.FOSTER
      ) {
        return;
      }
      if (
        type === ConversationType.VET &&
        targetUser?.role === UserRole.VETERINARIAN
      ) {
        return;
      }
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Drivers can only chat with shelters, fosters and veterinarians',
      );
    }

    // 4. Adopter chat to Shelter
    if (user.role === UserRole.ADOPTER) {
      if (
        type === ConversationType.SHELTER ||
        type === ConversationType.ADOPTION
      ) {
        return;
      }
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Adopters can only chat with shelters',
      );
    }
  }

  /** Generate default avatar URL based on name */
  private getDefaultAvatar(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=200`;
  }
}
