import { EventsEnum } from '@/common/enum/queue-events.enum';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
} from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { MessageDeliveryStatus, Prisma } from '@prisma';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import {
  ConversationType,
  InitOrLoadSingleConversationDto,
} from '../dto/conversation.dto';
import {
  ConversationParticipant,
  FormattedMessage,
  SingleConversationResponse,
} from '../types/single-conversation.types';

// Define the include object outside the class for type inference
const conversationInclude = {
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
    orderBy: { createdAt: 'asc' as const },
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
        },
      },
    },
  },
} satisfies Prisma.PrivateConversationInclude;

// Infer the return type of the conversation query
type ConversationWithRelations = Prisma.PrivateConversationGetPayload<{
  include: typeof conversationInclude;
}>;

@Injectable()
export class ConversationSingleQueryService {
  private readonly logger = new Logger(ConversationSingleQueryService.name);

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

    let conversation: ConversationWithRelations;

    // Find or create conversation based on type
    if (type === ConversationType.SHELTER) {
      conversation = await this.findOrCreateShelterConversation(
        userId,
        targetId,
      );
    } else if (
      type === ConversationType.VET ||
      type === ConversationType.DRIVER
    ) {
      conversation = await this.findOrCreateUserConversation(
        userId,
        targetId,
        userShelterId,
      );
    } else {
      throw new Error(`Invalid conversation type: ${type}`);
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

    const payload = successResponse(
      response,
      'Conversation loaded successfully',
    );
    client.emit(EventsEnum.CONVERSATION_RESPONSE, payload);
    return payload;
  }

  /** Find or create conversation with a SHELTER */
  private async findOrCreateShelterConversation(
    userId: string,
    shelterId: string,
  ): Promise<ConversationWithRelations> {
    // Find existing conversation
    let conversation = await this.prisma.client.privateConversation.findFirst({
      where: {
        shelterId: shelterId,
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      include: conversationInclude,
    });

    // Create if not exists
    if (!conversation) {
      this.logger.debug(`Creating new conversation with shelter ${shelterId}`);
      conversation = await this.prisma.client.privateConversation.create({
        data: {
          initiatorId: userId,
          shelterId: shelterId,
          // receiverId is null when chatting with a shelter
        },
        include: conversationInclude,
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
            shelterId: userShelterId,
            OR: [{ initiatorId: targetUserId }, { receiverId: targetUserId }],
          },
          include: conversationInclude,
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
          },
          include: conversationInclude,
        });
      }

      return conversation as ConversationWithRelations;
    } else {
      // Individual user to user conversation (no shelter)
      let conversation = await this.prisma.client.privateConversation.findFirst(
        {
          where: {
            shelterId: null,
            OR: [
              { initiatorId: userId, receiverId: targetUserId },
              { initiatorId: targetUserId, receiverId: userId },
            ],
          },
          include: conversationInclude,
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
          },
          include: conversationInclude,
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

    // Format messages with pagination
    const totalMessages = conversation.messages.length;
    const skip = (page - 1) * limit;
    const paginatedMessages = conversation.messages.slice(skip, skip + limit);

    const formattedMessages: FormattedMessage[] = paginatedMessages.map(
      (msg: ConversationWithRelations['messages'][number]) =>
        this.formatMessage(msg, userId),
    );

    const response: SingleConversationResponse = {
      conversationId: conversation.id,
      type: conversation.shelterId
        ? ConversationType.SHELTER
        : participant?.role === 'VETERINARIAN'
          ? ConversationType.VET
          : ConversationType.DRIVER,
      participant,
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
      // If current user is FROM the shelter, show the other user
      if (userShelterId === conversation.shelterId) {
        const otherUser =
          conversation.initiator?.id !== userId
            ? conversation.initiator
            : conversation.receiver;

        if (otherUser) {
          return {
            id: otherUser.id,
            name: otherUser.name,
            role: otherUser.role,
            avatarUrl:
              otherUser.profilePictureUrl ||
              this.getDefaultAvatar(otherUser.name),
            isActive: this.chatGateway.isOnline(otherUser.id),
            type: otherUser.role === 'VETERINARIAN' ? 'VET' : 'DRIVER',
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
            type: 'SHELTER',
          };
        }
      }
    } else {
      // No shelter involved, show the other user
      const otherUser =
        conversation.initiator?.id === userId
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
              ? 'VET'
              : otherUser.role === 'DRIVER'
                ? 'DRIVER'
                : 'USER',
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

    return {
      id: msg.id,
      content: msg.content ?? '', // ensure string for content
      type: msg.type,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        avatarUrl:
          msg.sender.profilePictureUrl ||
          this.getDefaultAvatar(msg.sender.name),
      },
      fileUrl: msg.file?.url ?? null,
      isMine,
      isFromShelter,
      isFromDriver,
      isFromVet,
      readBy:
        msg.statuses
          ?.filter(
            (s) =>
              s.userId !== userId && s.status === MessageDeliveryStatus.SEEN,
          )
          .map((s) => s.userId) || [],
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };
  }

  /** Generate default avatar URL based on name */
  private getDefaultAvatar(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=200`;
  }
}
