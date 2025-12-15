import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successResponse } from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MessageDeliveryStatus } from '@prisma';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { MarkReadDto, SendMessageDto } from '../dto/message.dto';
import {
  ChatParticipantType,
  FormattedMessage,
  ReadByParticipant,
} from '../types/single-conversation.types';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @SocketSafe()
  async sendMessage(client: Socket, dto: SendMessageDto) {
    const userId = client.data.userId;
    const { conversationId, content, type, fileId } = dto;

    // 1. Validate conversation exists & user is participant
    const conversation =
      await this.prisma.client.privateConversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: {
          shelter: {
            include: {
              shelterAdmins: { select: { id: true } },
              managers: { select: { id: true } },
            },
          },
        },
      });

    // 2. Determine recipients based on conversation type
    const recipientIds: string[] = [];

    if (conversation.shelterId) {
      // Shelter Conversation
      const userIsShelterMember =
        conversation.shelter?.shelterAdmins.some((a) => a.id === userId) ||
        conversation.shelter?.managers.some((m) => m.id === userId);

      if (userIsShelterMember) {
        const targetUserId =
          conversation.initiatorId === userId
            ? conversation.receiverId
            : conversation.initiatorId;

        // If for some reason target is null
        if (targetUserId) recipientIds.push(targetUserId);

        // Notify OTHER shelter staff
        const otherStaff = [
          ...(conversation.shelter?.shelterAdmins || []),
          ...(conversation.shelter?.managers || []),
        ].filter((m) => m.id !== userId);

        otherStaff.forEach((s) => recipientIds.push(s.id));
      } else {
        // Message FROM User TO Shelter
        // Recipients = All Shelter Staff
        const staff = [
          ...(conversation.shelter?.shelterAdmins || []),
          ...(conversation.shelter?.managers || []),
        ];
        staff.forEach((s) => recipientIds.push(s.id));
      }
    } else {
      // Direct User-to-User
      const targetUserId =
        conversation.initiatorId === userId
          ? conversation.receiverId
          : conversation.initiatorId;
      if (targetUserId) recipientIds.push(targetUserId);
    }

    // 3. Create Message
    const message = await this.prisma.client.privateMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        type: type || 'TEXT',
        fileId: fileId || undefined,
        // Create statuses for all recipients
        statuses: {
          create: recipientIds.map((rid) => ({
            userId: rid,
            status: MessageDeliveryStatus.SENT, // Initial status
          })),
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true,
            shelterAdminOfId: true,
            managerOfId: true,
            role: true,
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

    // 4. Format Message for Emission
    // Retrieve necessary context for formatting (isFromShelter etc)
    const senderShelterId =
      message.sender?.shelterAdminOfId || message.sender?.managerOfId;
    const isFromShelter = !!senderShelterId;

    const formattedMessage: FormattedMessage = {
      id: message.id,
      content: message.content ?? '',
      type: message.type,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatarUrl:
          message.sender.profilePictureUrl ||
          this.getDefaultAvatar(message.sender.name),
      },
      fileUrl: message.file?.url ?? null,
      file: message.file ?? null,
      isMine: false,
      isFromShelter,
      isFromDriver: message.sender.role === 'DRIVER',
      isFromVet: message.sender.role === 'VETERINARIAN',
      isRead: false,
      readBy: [], // Newly created
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    // 5. Emit to Recipients
    const senderPayload = successResponse({
      ...formattedMessage,
      isMine: true,
    });
    client.emit(EventsEnum.MESSAGE_NEW, senderPayload);

    // RECIPIENTS sockets:
    for (const rid of recipientIds) {
      this.chatGateway.emitToUserFirstSocket(
        rid,
        EventsEnum.MESSAGE_NEW,
        successResponse({
          ...formattedMessage,
          isMine: false, // It's theirs
        }),
      );
    }

    // update last message if type TEXT
    if (type === 'TEXT') {
      await this.prisma.client.privateConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: message.id,
        },
      });
    }

    return senderPayload;
  }

  /**
   * Mark messages as read
   */
  @SocketSafe()
  async markAsRead(client: Socket, dto: MarkReadDto) {
    const userId = client.data.userId;
    const { messageIds } = dto;

    if (!messageIds.length) return successResponse(null);

    // Update statuses
    await this.prisma.client.privateMessageStatus.updateMany({
      where: {
        userId: userId,
        messageId: { in: messageIds },
        status: { not: MessageDeliveryStatus.SEEN },
      },
      data: {
        status: MessageDeliveryStatus.SEEN,
      },
    });

    // Notify Senders that their messages were read
    // 1. Find the messages to get the SENDER IDs
    const messages = await this.prisma.client.privateMessage.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, senderId: true, conversationId: true },
    });

    // 2. Fetch User Info for the "ReadBy" payload
    const readerUser = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    if (!readerUser) return;

    // Construct ReadByParticipant
    const readByPayload: ReadByParticipant = {
      id:
        readerUser.shelterAdminOfId || readerUser.managerOfId || readerUser.id,
      name:
        readerUser.shelterAdminOfId || readerUser.managerOfId
          ? 'Shelter'
          : readerUser.name,
      type:
        readerUser.role === 'VETERINARIAN'
          ? ChatParticipantType.VET
          : readerUser.role === 'DRIVER'
            ? ChatParticipantType.DRIVER
            : readerUser.shelterAdminOfId || readerUser.managerOfId
              ? ChatParticipantType.SHELTER
              : ChatParticipantType.USER,
    };

    // 3. Emit updates
    for (const msg of messages) {
      // Notify Sender
      this.chatGateway.emitToUserFirstSocket(
        msg.senderId,
        EventsEnum.MESSAGE_STATUS_UPDATE,
        successResponse({
          messageId: msg.id,
          conversationId: msg.conversationId,
          status: MessageDeliveryStatus.SEEN,
          readBy: readByPayload,
        }),
      );
    }

    return successResponse(
      { count: messageIds.length },
      'Messages marked as read',
    );
  }

  private getDefaultAvatar(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=200`;
  }
}
