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

    // * If no type is provided, load all available contacts (merged view)
    if (!type) {
      result = await this.loadAllAvailableContacts(
        userId,
        user.role,
        userShelterId,
        skip,
        limit,
        search,
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
        // fallback: load all available contacts
        result = await this.loadAllAvailableContacts(
          userId,
          user.role,
          userShelterId,
          skip,
          limit,
          search,
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
      `Conversations fetched successfully for user ${userId}`,
    );

    client.emit(EventsEnum.CONVERSATION_LIST_RESPONSE, payload);
    return payload;
  }

  /** ---------------- Helper: load All Available Contacts (merged view) ---------------- */
  private async loadAllAvailableContacts(
    userId: string,
    userRole: string,
    userShelterId: string | null,
    skip = 0,
    limit = 20,
    search = '',
  ): Promise<{ list: any[]; total: number }> {
    // Based on user role, fetch all their possible contacts
    const contacts: any[] = [];

    if (userRole === 'VETERINARIAN') {
      // Vets can contact: Shelters + Drivers
      const [shelters, drivers] = await Promise.all([
        this.loadAllShelters(userId, 0, 999, search),
        this.loadAllDrivers(userId, 0, 999, search),
      ]);
      contacts.push(...shelters.list, ...drivers.list);
    } else if (userRole === 'DRIVER') {
      // Drivers can contact: Shelters + Vets
      const [shelters, vets] = await Promise.all([
        this.loadAllShelters(userId, 0, 999, search),
        this.loadAllVets(userId, 0, 999, search),
      ]);
      contacts.push(...shelters.list, ...vets.list);
    } else if (userRole === 'SHELTER_ADMIN' || userRole === 'MANAGER') {
      // Shelters can contact: Vets + Drivers
      const [vets, drivers] = await Promise.all([
        this.loadAllVets(userId, 0, 999, search, userShelterId),
        this.loadAllDrivers(userId, 0, 999, search, userShelterId),
      ]);
      contacts.push(...vets.list, ...drivers.list);
    }

    // Sort all contacts by lastActiveAt (most recent first)
    contacts.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    // Apply pagination
    const total = contacts.length;
    const paginatedList = contacts.slice(skip, skip + limit);

    return { list: paginatedList, total };
  }

  /** ---------------- Helper: load ALL Vets (not just existing conversations) ---------------- */
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
          profilePictureUrl: true,
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

    // Build conversation query based on whether user is from shelter or individual
    const conversationWhere: any = {
      OR: userShelterId
        ? [
            // Shelter-based conversations
            { shelterId: userShelterId, initiatorId: { in: vetIds } },
            { shelterId: userShelterId, receiverId: { in: vetIds } },
          ]
        : [
            // Individual user conversations
            {
              initiatorId: userId,
              receiverId: { in: vetIds },
              shelterId: null,
            },
            {
              receiverId: userId,
              initiatorId: { in: vetIds },
              shelterId: null,
            },
          ],
    };

    const conversations = await this.prisma.client.privateConversation.findMany(
      {
        where: conversationWhere,
        include: {
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
      },
    );

    // Create a map of vet conversations
    const convMap = new Map(
      conversations.map((c) => {
        const vetId =
          c.initiatorId !== userId && c.initiatorId !== userShelterId
            ? c.initiatorId
            : c.receiverId;
        return [vetId!, c];
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
        avatarUrl: vet.profilePictureUrl || this.getDefaultAvatar(vet.name),
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
      drivers: {
        status: 'APPROVED',
      },
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
          profilePictureUrl: true,
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

    // Build conversation query based on whether user is from shelter or individual
    const conversationWhere: Prisma.PrivateConversationWhereInput = {
      OR: userShelterId
        ? [
            // Shelter-based conversations
            { shelterId: userShelterId, initiatorId: { in: driverIds } },
            { shelterId: userShelterId, receiverId: { in: driverIds } },
          ]
        : [
            // Individual user conversations
            {
              initiatorId: userId,
              receiverId: { in: driverIds },
              shelterId: null,
            },
            {
              receiverId: userId,
              initiatorId: { in: driverIds },
              shelterId: null,
            },
          ],
    };

    const conversations = await this.prisma.client.privateConversation.findMany(
      {
        where: conversationWhere,
        include: {
          lastMessage: { include: { sender: { select: { name: true } } } },
        },
      },
    );

    // Create a map of driver conversations
    const convMap = new Map(
      conversations.map((c) => {
        const driverId =
          c.initiatorId !== userId && c.initiatorId !== userShelterId
            ? c.initiatorId
            : c.receiverId;
        return [driverId!, c];
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
        avatarUrl:
          driver.profilePictureUrl || this.getDefaultAvatar(driver.name),
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
      status: 'APPROVED', // Only show approved shelters
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [shelters, totalShelters] = await this.prisma.client.$transaction([
      this.prisma.client.shelter.findMany({
        where: shelterWhere,
        select: {
          id: true,
          name: true,
          logoId: true,
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
    const convMap = new Map(conversations.map((c) => [c.shelterId!, c]));

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
        avatarUrl: shelter.logoUrl || this.getDefaultAvatar(shelter.name),
      };
    });

    // Sort by lastActiveAt (most recent first)
    list.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    return { list, total: totalShelters };
  }

  /** ---------------- Helper: Generate default avatar URL based on name ---------------- */
  private getDefaultAvatar(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=200`;
  }
}
