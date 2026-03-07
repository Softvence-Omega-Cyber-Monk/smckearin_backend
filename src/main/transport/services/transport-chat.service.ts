import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ConversationScope,
  MessageDeliveryStatus,
  MessageType,
  Prisma,
  UserRole,
} from '@prisma';
import {
  GetTransportChatMessagesDto,
  MarkTransportChatReadDto,
  SendTransportChatMessageDto,
} from '../dto/transport-chat.dto';

type ChatUserContext = {
  id: string;
  role: UserRole;
  shelterId: string | null;
};

@Injectable()
export class TransportChatService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get transport chat list', 'TransportChat')
  async getMyTransportChats(userId: string, dto: GetTransportChatMessagesDto) {
    const user = await this.getUserContext(userId);
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PrivateConversationWhereInput = {
      chatScope: ConversationScope.TRANSPORT,
    };

    if (!this.isAdmin(user.role)) {
      const access: Prisma.PrivateConversationWhereInput[] = [
        { initiatorId: userId },
        { receiverId: userId },
      ];

      if (user.shelterId) {
        access.push({ shelterId: user.shelterId });
      }

      where.OR = access;
    }

    const [conversations, total] = await this.prisma.client.$transaction([
      this.prisma.client.privateConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          transport: {
            select: {
              id: true,
              status: true,
              priorityLevel: true,
              transPortDate: true,
              animal: { select: { id: true, name: true, breed: true } },
              shelter: { select: { id: true, name: true } },
              driver: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true } },
                },
              },
              vet: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
          lastMessage: {
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              sender: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.privateConversation.count({ where }),
    ]);

    const data = conversations.map((conv) => ({
      conversationId: conv.id,
      transportId: conv.transportId,
      chatScope: conv.chatScope,
      transport: conv.transport,
      lastMessage: conv.lastMessage,
      updatedAt: conv.updatedAt,
    }));

    return successPaginatedResponse(
      data,
      { page, limit, total },
      'Transport chats fetched',
    );
  }

  @HandleError('Failed to load transport chat', 'TransportChat')
  async getTransportChat(
    userId: string,
    transportId: string,
    dto: GetTransportChatMessagesDto,
  ) {
    const user = await this.getUserContext(userId);
    const transport = await this.getTransportForChat(transportId);
    this.ensureTransportChatAccess(user, transport);

    const conversation = await this.getOrCreateConversation(
      user.id,
      user,
      transport,
    );
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 30;
    const skip = (page - 1) * limit;

    const [messages, total] = await this.prisma.client.$transaction([
      this.prisma.client.privateMessage.findMany({
        where: { conversationId: conversation.id },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.privateMessage.count({
        where: { conversationId: conversation.id },
      }),
    ]);

    const ordered = [...messages].reverse().map((msg) => ({
      id: msg.id,
      content: msg.content ?? '',
      type: msg.type,
      file: msg.file ?? null,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        role: msg.sender.role,
        avatarUrl: msg.sender.profilePictureUrl,
      },
      isMine: msg.senderId === user.id,
      isRead: msg.statuses.some(
        (s) => s.userId !== user.id && s.status === MessageDeliveryStatus.SEEN,
      ),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    await this.markConversationAsSeen(user.id, conversation.id);

    return successResponse(
      {
        conversationId: conversation.id,
        transport: {
          id: transport.id,
          status: transport.status,
          priorityLevel: transport.priorityLevel,
          transPortDate: transport.transPortDate,
          animal: transport.animal,
          shelter: transport.shelter,
          driver: transport.driver,
          vet: transport.vet,
        },
        messages: ordered,
        metadata: {
          page,
          limit,
          total,
          totalPage: Math.ceil(total / limit),
        },
      },
      'Transport chat loaded',
    );
  }

  @HandleError('Failed to send transport chat message', 'TransportChat')
  async sendTransportMessage(
    userId: string,
    transportId: string,
    dto: SendTransportChatMessageDto,
  ) {
    if (!dto.content?.trim() && !dto.fileId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Either content or fileId is required',
      );
    }

    const user = await this.getUserContext(userId);
    const transport = await this.getTransportForChat(transportId);
    this.ensureTransportChatAccess(user, transport);

    const conversation = await this.getOrCreateConversation(
      user.id,
      user,
      transport,
    );
    const recipients = await this.getRecipientIds(conversation, user.id);

    const message = await this.prisma.client.privateMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        content: dto.content?.trim() || undefined,
        type: dto.type ?? MessageType.TEXT,
        fileId: dto.fileId || undefined,
        statuses: {
          create: recipients.map((recipientId) => ({
            userId: recipientId,
            status: MessageDeliveryStatus.SENT,
          })),
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
            profilePictureUrl: true,
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
      },
    });

    await this.prisma.client.privateConversation.update({
      where: { id: conversation.id },
      data: { lastMessageId: message.id },
    });

    return successResponse(
      {
        id: message.id,
        conversationId: conversation.id,
        content: message.content ?? '',
        type: message.type,
        file: message.file ?? null,
        sender: message.sender,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
      'Message sent',
    );
  }

  @HandleError(
    'Failed to mark transport chat messages as read',
    'TransportChat',
  )
  async markTransportMessagesRead(
    userId: string,
    transportId: string,
    dto: MarkTransportChatReadDto,
  ) {
    const user = await this.getUserContext(userId);
    const transport = await this.getTransportForChat(transportId);
    this.ensureTransportChatAccess(user, transport);

    const conversation = await this.getOrCreateConversation(
      user.id,
      user,
      transport,
    );

    const where: Prisma.PrivateMessageStatusWhereInput = {
      userId: user.id,
      status: { not: MessageDeliveryStatus.SEEN },
      message: {
        conversationId: conversation.id,
      },
    };

    if (dto.messageIds?.length) {
      where.messageId = { in: dto.messageIds };
    }

    const updated = await this.prisma.client.privateMessageStatus.updateMany({
      where,
      data: {
        status: MessageDeliveryStatus.SEEN,
      },
    });

    return successResponse(
      { updatedCount: updated.count },
      'Messages marked as read',
    );
  }

  private async getUserContext(userId: string): Promise<ChatUserContext> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    return {
      id: user.id,
      role: user.role,
      shelterId: user.shelterAdminOfId ?? user.managerOfId ?? null,
    };
  }

  private async getTransportForChat(transportId: string) {
    return this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: {
        id: true,
        status: true,
        priorityLevel: true,
        transPortDate: true,
        shelterId: true,
        animal: {
          select: {
            id: true,
            name: true,
            breed: true,
          },
        },
        shelter: {
          select: {
            id: true,
            name: true,
            shelterAdmins: { select: { id: true } },
            managers: { select: { id: true } },
          },
        },
        driver: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        vet: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  private ensureTransportChatAccess(
    user: ChatUserContext,
    transport: Awaited<ReturnType<TransportChatService['getTransportForChat']>>,
  ): void {
    if (this.isAdmin(user.role)) {
      return;
    }

    const canAccessByShelter =
      !!user.shelterId && user.shelterId === transport.shelterId;
    const canAccessByDriver = transport.driver?.userId === user.id;
    const canAccessByVet = transport.vet?.userId === user.id;

    if (!canAccessByShelter && !canAccessByDriver && !canAccessByVet) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You are not allowed to access this transport chat',
      );
    }
  }

  private async getOrCreateConversation(
    userId: string,
    user: ChatUserContext,
    transport: Awaited<ReturnType<TransportChatService['getTransportForChat']>>,
  ) {
    const existing = await this.prisma.client.privateConversation.findUnique({
      where: {
        chatScope_transportId: {
          chatScope: ConversationScope.TRANSPORT,
          transportId: transport.id,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const counterpartId = this.resolveCounterpartUserId(
      userId,
      user,
      transport,
    );

    return this.prisma.client.privateConversation.create({
      data: {
        initiatorId: userId,
        receiverId: counterpartId,
        shelterId: transport.shelterId,
        chatScope: ConversationScope.TRANSPORT,
        transportId: transport.id,
      },
    });
  }

  private resolveCounterpartUserId(
    userId: string,
    user: ChatUserContext,
    transport: Awaited<ReturnType<TransportChatService['getTransportForChat']>>,
  ): string {
    if (user.shelterId) {
      const rideUserId = transport.driver?.userId ?? transport.vet?.userId;
      if (!rideUserId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Assign a driver or veterinarian first to start transport chat',
        );
      }
      return rideUserId;
    }

    const shelterTeamIds = [
      ...(transport.shelter?.shelterAdmins.map((m) => m.id) ?? []),
      ...(transport.shelter?.managers.map((m) => m.id) ?? []),
    ].filter((id) => id !== userId);

    if (shelterTeamIds.length === 0) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'No shelter team member found for this transport chat',
      );
    }

    return shelterTeamIds[0];
  }

  private async getRecipientIds(
    conversation: {
      shelterId: string | null;
      initiatorId: string;
      receiverId: string | null;
    },
    senderId: string,
  ): Promise<string[]> {
    const recipients = new Set<string>();

    if (conversation.shelterId) {
      const shelter = await this.prisma.client.shelter.findUnique({
        where: { id: conversation.shelterId },
        select: {
          shelterAdmins: { select: { id: true } },
          managers: { select: { id: true } },
        },
      });

      const shelterStaff = [
        ...(shelter?.shelterAdmins.map((s) => s.id) ?? []),
        ...(shelter?.managers.map((s) => s.id) ?? []),
      ];

      for (const id of shelterStaff) {
        if (id !== senderId) recipients.add(id);
      }
    }

    const directCounterpart =
      conversation.initiatorId === senderId
        ? conversation.receiverId
        : conversation.initiatorId;

    if (directCounterpart && directCounterpart !== senderId) {
      recipients.add(directCounterpart);
    }

    return [...recipients];
  }

  private async markConversationAsSeen(userId: string, conversationId: string) {
    await this.prisma.client.privateMessageStatus.updateMany({
      where: {
        userId,
        status: { not: MessageDeliveryStatus.SEEN },
        message: { conversationId },
      },
      data: { status: MessageDeliveryStatus.SEEN },
    });
  }

  private isAdmin(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }
}
