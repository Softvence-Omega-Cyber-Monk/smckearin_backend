import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successResponse } from '@/common/utils/response.util';
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

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    // Determine user's shelter(s) if admin/manager
    const myShelterIds: string[] = [];
    if (user.shelterAdminOfId) myShelterIds.push(user.shelterAdminOfId);
    if (user.managerOfId) myShelterIds.push(user.managerOfId);

    let result: { list: any[]; total: number };

    // Decide which helper(s) to call based on role & type filter
    if (user.role === 'VETERINARIAN') {
      if (type === ConversationType.SHELTER) {
        result = await this.loadShelters(userId, myShelterIds, skip, limit);
      } else {
        // Default: show drivers
        result = await this.loadDrivers(userId, skip, limit);
      }
    } else if (user.role === 'DRIVER') {
      if (type === ConversationType.SHELTER) {
        result = await this.loadShelters(userId, myShelterIds, skip, limit);
      } else {
        // Default: show vets
        result = await this.loadVets(userId, skip, limit);
      }
    } else if (user.role === 'SHELTER_ADMIN' || user.role === 'MANAGER') {
      // Shelter sees both vets and drivers
      if (type === ConversationType.VET) {
        result = await this.loadVets(userId, skip, limit, myShelterIds);
      } else if (type === ConversationType.DRIVER) {
        result = await this.loadDrivers(userId, skip, limit, myShelterIds);
      } else {
        // merged list: vets + drivers
        const vets = await this.loadVets(userId, skip, limit, myShelterIds);
        const drivers = await this.loadDrivers(
          userId,
          skip,
          limit,
          myShelterIds,
        );
        result = {
          list: [...vets.list, ...drivers.list],
          total: vets.total + drivers.total,
        };
      }
    } else {
      // fallback: load all existing conversations
      result = await this.loadAllExistingConversations(
        userId,
        myShelterIds,
        skip,
        limit,
      );
    }

    const payload = successResponse({
      list: result.list,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });

    client.emit(EventsEnum.CONVERSATION_LIST_RESPONSE, payload);
    return payload;
  }

  /** ---------------- Helper: load All Existing Conversations ---------------- */
  private async loadAllExistingConversations(
    userId: string,
    myShelterIds: string[],
    skip = 0,
    limit = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: Prisma.PrivateConversationWhereInput = {
      OR: [
        { initiatorId: userId },
        { receiverId: userId },
        ...(myShelterIds.length ? [{ shelterId: { in: myShelterIds } }] : []),
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
      .map((conv) => this.formatConversationResult(conv, userId, myShelterIds))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Vets ---------------- */
  private async loadVets(
    userId: string,
    skip = 0,
    limit = 20,
    shelterIds: string[] = [],
  ): Promise<{ list: any[]; total: number }> {
    // Vets connected to this shelter(s) or user
    const where: Prisma.PrivateConversationWhereInput = {
      shelterId: shelterIds.length ? { in: shelterIds } : undefined,
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
      .map((c) => this.formatConversationResult(c, userId, shelterIds))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Drivers ---------------- */
  private async loadDrivers(
    userId: string,
    skip = 0,
    limit = 20,
    shelterIds: string[] = [],
  ): Promise<{ list: any[]; total: number }> {
    const where: Prisma.PrivateConversationWhereInput = {
      shelterId: shelterIds.length ? { in: shelterIds } : undefined,
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
      .map((c) => this.formatConversationResult(c, userId, shelterIds))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Helper: load Shelters ---------------- */
  private async loadShelters(
    userId: string,
    shelterIds: string[] = [],
    skip = 0,
    limit = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = { shelterId: { not: null } };
    where.OR = [
      { initiatorId: userId },
      { receiverId: userId },
      ...(shelterIds.length ? [{ shelterId: { in: shelterIds } }] : []),
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
      .map((c) => this.formatConversationResult(c, userId, shelterIds))
      .filter(Boolean);
    return { list, total: count };
  }

  /** ---------------- Shared formatter ---------------- */
  private formatConversationResult(
    conv: any,
    userId: string,
    shelterIds: string[],
  ) {
    let otherPart: any = null;
    let type = 'USER';
    const isMyShelter =
      shelterIds.length > 0 && shelterIds.includes(conv.shelterId || '');

    if (conv.shelterId) {
      otherPart = isMyShelter
        ? !shelterIds.includes(conv.initiatorId)
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
      lastMessage: conv.lastMessage?.content || 'Msg',
      isActive: true,
      conversationId: conv.id,
      lastActiveAt: conv.updatedAt,
    };
  }
}
