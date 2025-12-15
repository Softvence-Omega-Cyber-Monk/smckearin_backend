import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successPaginatedResponse } from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma';
import { Socket } from 'socket.io';
import {
  ConversationType,
  LoadConversationsDto,
} from '../dto/conversation.dto';

@Injectable()
export class ConversationQueryService {
  private logger = new Logger(ConversationQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @SocketSafe()
  async loadConversations(client: Socket, dto: LoadConversationsDto) {
    const userId = client.data.userId;
    const { page = 1, limit = 20, type } = dto;
    const skip = (page - 1) * limit;
    const search = dto?.search ? dto.search?.trim() : '';

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    // Determine effective single shelter id (admin or manager)
    const userShelterId: string | null =
      user.shelterAdminOfId ?? user.managerOfId ?? null;

    let result: { list: any[]; total: number };

    // * If no type is provided, load all existing conversations
    if (!type) {
      result = await this.loadAllExistingConversations(
        userId,
        userShelterId,
        skip,
        limit,
      );
    } else {
      // Decide which helper(s) to call based on role & type filter
      if (user.role === 'VETERINARIAN') {
        if (type === ConversationType.SHELTER) {
          result = await this.loadShelters(userId, userShelterId, skip, limit);
        } else {
          // Default: show drivers
          result = await this.loadDrivers(userId, skip, limit);
        }
      } else if (user.role === 'DRIVER') {
        if (type === ConversationType.SHELTER) {
          result = await this.loadShelters(userId, userShelterId, skip, limit);
        } else {
          // Default: show vets
          result = await this.loadVets(userId, skip, limit);
        }
      } else if (user.role === 'SHELTER_ADMIN' || user.role === 'MANAGER') {
        // Shelter sees both vets and drivers
        if (type === ConversationType.VET) {
          result = await this.loadVets(userId, skip, limit, userShelterId);
        } else {
          // Default: show drivers
          result = await this.loadDrivers(userId, skip, limit, userShelterId);
        }
      } else {
        // fallback: load all existing conversations
        result = await this.loadAllExistingConversations(
          userId,
          userShelterId,
          skip,
          limit,
        );
      }
    }

    const payload = successPaginatedResponse(
      result.list,
      {
        page,
        limit,
        total: result.total,
      },
      `Conversations fetched successfully based on type ${type} and role ${user.role}`,
    );

    client.emit(EventsEnum.CONVERSATION_LIST_RESPONSE, payload);
    return payload;
  }

  /** ---------------- Helper: load All Existing Conversations ---------------- */
  private async loadAllExistingConversations(
    userId: string,
    userShelterId: string | null,
    skip = 0,
    limit = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: Prisma.PrivateConversationWhereInput = {
      OR: [
        { initiatorId: userId },
        { receiverId: userId },
        ...(userShelterId ? [{ shelterId: userShelterId }] : []),
      ],
    };
    const [conversations, count] = await this.prisma.client.$transaction([
      this.prisma.client.privateConversation.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          shelter: { select: { id: true, name: true, logoUrl: true } },
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.privateConversation.count({ where }),
    ]);
    const list = conversations
      .map((conv) => this.formatConversationResult(conv, userId, userShelterId))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Vets ---------------- */
  private async loadVets(
    userId: string,
    skip = 0,
    limit = 20,
    userShelterId: string | null = null,
  ): Promise<{ list: any[]; total: number }> {
    // Vets connected to this shelter or user
    const where: Prisma.PrivateConversationWhereInput = {
      // restrict to conversations attached to shelter if provided
      ...(userShelterId ? { shelterId: userShelterId } : {}),
      OR: [
        { initiatorId: userId, receiver: { role: 'VETERINARIAN' } },
        { receiverId: userId, initiator: { role: 'VETERINARIAN' } },
      ],
    };

    const [conversations, count] = await this.prisma.client.$transaction([
      this.prisma.client.privateConversation.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.privateConversation.count({ where }),
    ]);

    const list = conversations
      .map((c) => this.formatConversationResult(c, userId, userShelterId))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Drivers ---------------- */
  private async loadDrivers(
    userId: string,
    skip = 0,
    limit = 20,
    userShelterId: string | null = null,
  ): Promise<{ list: any[]; total: number }> {
    const where: Prisma.PrivateConversationWhereInput = {
      ...(userShelterId ? { shelterId: userShelterId } : {}),
      OR: [
        { initiatorId: userId, receiver: { role: 'DRIVER' } },
        { receiverId: userId, initiator: { role: 'DRIVER' } },
      ],
    };

    const [conversations, count] = await this.prisma.client.$transaction([
      this.prisma.client.privateConversation.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.privateConversation.count({ where }),
    ]);

    const list = conversations
      .map((c) => this.formatConversationResult(c, userId, userShelterId))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Shelters ---------------- */
  private async loadShelters(
    userId: string,
    userShelterId: string | null = null,
    skip = 0,
    limit = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = { shelterId: { not: null } };
    where.OR = [
      { initiatorId: userId },
      { receiverId: userId },
      ...(userShelterId ? [{ shelterId: userShelterId }] : []),
    ];

    const [conversations, count] = await this.prisma.client.$transaction([
      this.prisma.client.privateConversation.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePictureId: true,
            },
          },
          shelter: { select: { id: true, name: true, logoUrl: true } },
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.privateConversation.count({ where }),
    ]);

    const list = conversations
      .map((c) => this.formatConversationResult(c, userId, userShelterId))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Shared formatter ---------------- */
  private formatConversationResult(
    conv: any,
    userId: string,
    userShelterId: string | null,
  ) {
    let otherPart: any = null;
    let type = 'USER';
    const isMyShelter = !!userShelterId && userShelterId === conv.shelterId;

    if (conv.shelterId) {
      otherPart = isMyShelter
        ? !userShelterId || userShelterId !== conv.initiatorId
          ? conv.initiator
          : conv.receiver
        : conv.shelter;
      type =
        conv.shelterId && !isMyShelter
          ? 'SHELTER'
          : otherPart?.role === 'VETERINARIAN'
            ? 'VET'
            : otherPart?.role === 'DRIVER'
              ? 'DRIVER'
              : 'USER';
    } else {
      otherPart = conv.initiatorId === userId ? conv.receiver : conv.initiator;
      type =
        otherPart?.role === 'VETERINARIAN'
          ? 'VET'
          : otherPart?.role === 'DRIVER'
            ? 'DRIVER'
            : 'USER';
    }

    if (!otherPart) return null;

    return {
      id: otherPart.id,
      name: otherPart.name,
      type,
      lastMessage: conv.lastMessage?.content || 'No message yet',
      isActive: true,
      conversationId: conv.id,
      lastActiveAt: conv.updatedAt,
    };
  }
}
