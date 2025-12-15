import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successPaginatedResponse } from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import { Socket } from 'socket.io';
import {
  ConversationType,
  LoadConversationsDto,
} from '../dto/conversation.dto';

@Injectable()
export class ConversationQueryService {
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
          result = await this.loadAllShelters(userId, skip, limit, search);
        } else {
          // Show all drivers
          result = await this.loadAllDrivers(userId, skip, limit, search);
        }
      } else if (user.role === 'DRIVER') {
        if (type === ConversationType.SHELTER) {
          result = await this.loadAllShelters(userId, skip, limit, search);
        } else {
          // Show all vets
          result = await this.loadAllVets(userId, skip, limit, search);
        }
      } else if (user.role === 'SHELTER_ADMIN' || user.role === 'MANAGER') {
        // Shelter sees both vets and drivers
        if (type === ConversationType.VET) {
          result = await this.loadAllVets(
            userId,
            skip,
            limit,
            search,
            userShelterId,
          );
        } else {
          // Show all drivers
          result = await this.loadAllDrivers(
            userId,
            skip,
            limit,
            search,
            userShelterId,
          );
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

  /** ---------------- Helper: load ALL Vets ---------------- */
  private async loadAllVets(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
    userShelterId: string | null = null,
  ): Promise<{ list: any[]; total: number }> {
    // Get ALL vets from the system
    const vetWhere: Prisma.UserWhereInput = {
      role: 'VETERINARIAN',
      status: 'ACTIVE',
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [vets, totalVets] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where: vetWhere,
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          lastActiveAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.user.count({ where: vetWhere }),
    ]);

    // Now fetch existing conversations for these vets
    const vetIds = vets.map((v) => v.id);
    const conversations = await this.prisma.client.privateConversation.findMany(
      {
        where: {
          ...(userShelterId ? { shelterId: userShelterId } : {}),
          OR: [
            { initiatorId: userId, receiverId: { in: vetIds } },
            { receiverId: userId, initiatorId: { in: vetIds } },
            ...(userShelterId
              ? [
                  { shelterId: userShelterId, initiatorId: { in: vetIds } },
                  { shelterId: userShelterId, receiverId: { in: vetIds } },
                ]
              : []),
          ],
        },
        include: {
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
      },
    );

    // Create a map of vet conversations
    const convMap = new Map(
      conversations.map((c) => {
        const vetId =
          c.initiatorId === userId || c.initiatorId === userShelterId
            ? c.receiverId
            : c.initiatorId;
        return [vetId, c];
      }),
    );

    // Format the results
    const list = vets.map((vet) => {
      const conv = convMap.get(vet.id);
      return {
        id: vet.id,
        name: vet.name,
        type: 'VET',
        lastMessage: conv?.lastMessage?.content || 'No message yet',
        isActive: true,
        conversationId: conv?.id || null,
        lastActiveAt: conv?.updatedAt || vet.lastActiveAt || new Date(),
        profilePictureId: vet.profilePictureId,
      };
    });

    // Sort by lastActiveAt (most recent first)
    list.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    return { list, total: totalVets };
  }

  /** ---------------- Helper: load ALL Drivers (not just existing conversations) ---------------- */
  private async loadAllDrivers(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
    userShelterId: string | null = null,
  ): Promise<{ list: any[]; total: number }> {
    // Get ALL drivers from the system
    const driverWhere: Prisma.UserWhereInput = {
      role: 'DRIVER',
      status: 'ACTIVE',
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [drivers, totalDrivers] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where: driverWhere,
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          lastActiveAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.user.count({ where: driverWhere }),
    ]);

    // Now fetch existing conversations for these drivers
    const driverIds = drivers.map((d) => d.id);
    const conversations = await this.prisma.client.privateConversation.findMany(
      {
        where: {
          ...(userShelterId ? { shelterId: userShelterId } : {}),
          OR: [
            { initiatorId: userId, receiverId: { in: driverIds } },
            { receiverId: userId, initiatorId: { in: driverIds } },
            ...(userShelterId
              ? [
                  { shelterId: userShelterId, initiatorId: { in: driverIds } },
                  { shelterId: userShelterId, receiverId: { in: driverIds } },
                ]
              : []),
          ],
        },
        include: {
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
      },
    );

    // Create a map of driver conversations
    const convMap = new Map(
      conversations.map((c) => {
        const driverId =
          c.initiatorId === userId || c.initiatorId === userShelterId
            ? c.receiverId
            : c.initiatorId;
        return [driverId, c];
      }),
    );

    // Format the results
    const list = drivers.map((driver) => {
      const conv = convMap.get(driver.id);
      return {
        id: driver.id,
        name: driver.name,
        type: 'DRIVER',
        lastMessage: conv?.lastMessage?.content || 'No message yet',
        isActive: true,
        conversationId: conv?.id || null,
        lastActiveAt: conv?.updatedAt || driver.lastActiveAt || new Date(),
        profilePictureId: driver.profilePictureId,
      };
    });

    // Sort by lastActiveAt (most recent first)
    list.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    return { list, total: totalDrivers };
  }

  /** ---------------- Helper: load ALL Shelters (not just existing conversations) ---------------- */
  private async loadAllShelters(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
  ): Promise<{ list: any[]; total: number }> {
    // Get ALL shelters from the system
    const shelterWhere: Prisma.ShelterWhereInput = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [shelters, totalShelters] = await this.prisma.client.$transaction([
      this.prisma.client.shelter.findMany({
        where: shelterWhere,
        select: {
          id: true,
          name: true,
          logoUrl: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.shelter.count({ where: shelterWhere }),
    ]);

    // Now fetch existing conversations for these shelters
    const shelterIds = shelters.map((s) => s.id);
    const conversations = await this.prisma.client.privateConversation.findMany(
      {
        where: {
          shelterId: { in: shelterIds },
          OR: [{ initiatorId: userId }, { receiverId: userId }],
        },
        include: {
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
      },
    );

    // Create a map of shelter conversations
    const convMap = new Map(conversations.map((c) => [c.shelterId, c]));

    // Format the results
    const list = shelters.map((shelter) => {
      const conv = convMap.get(shelter.id);
      return {
        id: shelter.id,
        name: shelter.name,
        type: 'SHELTER',
        lastMessage: conv?.lastMessage?.content || 'No message yet',
        isActive: true,
        conversationId: conv?.id || null,
        lastActiveAt: conv?.updatedAt || shelter.updatedAt || new Date(),
        logoUrl: shelter.logoUrl,
      };
    });

    // Sort by lastActiveAt (most recent first)
    list.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    return { list, total: totalShelters };
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
