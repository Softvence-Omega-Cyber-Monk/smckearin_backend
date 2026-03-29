import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successPaginatedResponse } from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConversationScope, Prisma } from '@prisma';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import {
  ConversationType,
  LoadConversationsDto,
} from '../dto/conversation.dto';
import {
  Contact,
  ContactType,
  LoadContactsResult,
} from '../types/conversation.types';

@Injectable()
export class ConversationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

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

    let result: LoadContactsResult;

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
        } else if (type === ConversationType.FOSTER) {
          result = await this.loadAllFosters(userId, skip, limit, search);
        } else {
          // Show all vets
          result = await this.loadAllVets(userId, skip, limit, search);
        }
      } else if (user.role === 'SHELTER_ADMIN' || user.role === 'MANAGER') {
        // Shelter sees vets, drivers, and fosters
        if (type === ConversationType.VET) {
          result = await this.loadAllVets(
            userId,
            skip,
            limit,
            search,
            userShelterId,
          );
        } else if (type === ConversationType.FOSTER) {
          result = await this.loadAllFosters(
            userId,
            skip,
            limit,
            search,
            userShelterId,
          );
        } else {
          // Default: show all drivers
          result = await this.loadAllDrivers(
            userId,
            skip,
            limit,
            search,
            userShelterId,
          );
        }
      } else if (user.role === 'FOSTER') {
        if (type === ConversationType.DRIVER) {
          result = await this.loadAllDrivers(userId, skip, limit, search);
        } else {
          // Fosters can only contact Shelters
          result = await this.loadAllShelters(userId, skip, limit, search);
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
  ): Promise<LoadContactsResult> {
    // Based on user role, fetch all their possible contacts
    const contacts: Contact[] = [];

    if (userRole === 'VETERINARIAN') {
      // Vets can contact: Shelters + Drivers
      const [shelters, drivers] = await Promise.all([
        this.loadAllShelters(userId, 0, 999, search),
        this.loadAllDrivers(userId, 0, 999, search),
      ]);
      contacts.push(...shelters.list, ...drivers.list);
    } else if (userRole === 'DRIVER') {
      // Drivers can contact: Shelters + Vets + Fosters
      const [shelters, vets, fosters] = await Promise.all([
        this.loadAllShelters(userId, 0, 999, search),
        this.loadAllVets(userId, 0, 999, search),
        this.loadAllFosters(userId, 0, 999, search),
      ]);
      contacts.push(...shelters.list, ...vets.list, ...fosters.list);
    } else if (userRole === 'SHELTER_ADMIN' || userRole === 'MANAGER') {
      // Shelters can contact: Vets + Drivers + Fosters
      const [vets, drivers, fosters] = await Promise.all([
        this.loadAllVets(userId, 0, 999, search, userShelterId),
        this.loadAllDrivers(userId, 0, 999, search, userShelterId),
        this.loadAllFosters(userId, 0, 999, search, userShelterId),
      ]);
      contacts.push(...vets.list, ...drivers.list, ...fosters.list);
    } else if (userRole === 'FOSTER') {
      // Fosters can contact: Shelters + Drivers
      const [shelters, drivers] = await Promise.all([
        this.loadAllShelters(userId, 0, 999, search),
        this.loadAllDrivers(userId, 0, 999, search),
      ]);
      contacts.push(...shelters.list, ...drivers.list);
    }

    // Sort all contacts: Online first, then by createdAt desc (or default order)
    // Removed lastActiveAt, so simple sort by active status first
    contacts.sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

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
  ): Promise<LoadContactsResult> {
    // Get ALL vets from the system
    const vetWhere: Prisma.UserWhereInput = {
      role: 'VETERINARIAN',
      status: 'ACTIVE',
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [vets] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where: vetWhere,
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          profilePictureUrl: true,
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
      chatScope: ConversationScope.MAIN,
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
        const vetId = vetIds.includes(c.initiatorId)
          ? c.initiatorId
          : c.receiverId;
        return [vetId!, c];
      }),
    );

    // Format the results
    const list: Contact[] = vets.map((vet) => {
      const conv = convMap.get(vet.id);
      return {
        id: vet.id,
        name: vet.name,
        type: ContactType.VET,
        lastMessage: this.formatLastMessage(conv?.lastMessage),
        lastMessageAt: conv?.updatedAt || null,
        isActive: this.chatGateway.isOnline(vet.id),
        conversationId: conv?.id || null,
        avatarUrl: vet.profilePictureUrl || this.getDefaultAvatar(vet.name),
      };
    });

    // Sort: Online first
    list.sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

    // Only return contacts with an existing conversation
    const filtered = list.filter((c) => c.conversationId !== null);
    return { list: filtered, total: filtered.length };
  }

  /** ---------------- Helper: load ALL Drivers (not just existing conversations) ---------------- */
  private async loadAllDrivers(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
    userShelterId: string | null = null,
  ): Promise<LoadContactsResult> {
    // Get ALL drivers from the system
    const driverWhere: Prisma.UserWhereInput = {
      role: 'DRIVER',
      status: 'ACTIVE',
      drivers: {
        status: { in: ['APPROVED', 'PENDING'] },
      },
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [drivers] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where: driverWhere,
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          profilePictureUrl: true,
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
      chatScope: ConversationScope.MAIN,
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
        const driverId = driverIds.includes(c.initiatorId)
          ? c.initiatorId
          : c.receiverId;
        return [driverId!, c];
      }),
    );

    // Format the results
    const list: Contact[] = drivers.map((driver) => {
      const conv = convMap.get(driver.id);
      return {
        id: driver.id,
        name: driver.name,
        type: ContactType.DRIVER,
        lastMessage: this.formatLastMessage(conv?.lastMessage),
        lastMessageAt: conv?.updatedAt || null,
        isActive: this.chatGateway.isOnline(driver.id),
        conversationId: conv?.id || null,
        avatarUrl:
          driver.profilePictureUrl || this.getDefaultAvatar(driver.name),
      };
    });

    // Sort: Online first
    list.sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

    // Only return contacts with an existing conversation
    const filtered = list.filter((c) => c.conversationId !== null);
    return { list: filtered, total: filtered.length };
  }

  /** ---------------- Helper: load ALL Shelters (not just existing conversations) ---------------- */
  private async loadAllShelters(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
  ): Promise<LoadContactsResult> {
    // Get ALL shelters from the system
    const shelterWhere: Prisma.ShelterWhereInput = {
      status: 'APPROVED', // Only show approved shelters
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [shelters] = await this.prisma.client.$transaction([
      this.prisma.client.shelter.findMany({
        where: shelterWhere,
        select: {
          id: true,
          name: true,
          logoId: true,
          logoUrl: true,
          updatedAt: true,
          managers: { select: { id: true } },
          shelterAdmins: { select: { id: true } },
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
          chatScope: ConversationScope.MAIN,
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
    const list: Contact[] = shelters.map((shelter) => {
      const conv = convMap.get(shelter.id);

      // Check if ANY member (manager or admin) is online
      const teamIds = [
        ...shelter.shelterAdmins?.map((a) => a.id),
        ...shelter.managers?.map((m) => m.id),
      ];
      const isTeamActive = teamIds.some((id) => this.chatGateway.isOnline(id));

      return {
        id: shelter.id,
        name: shelter.name,
        type: ContactType.SHELTER,
        lastMessage: this.formatLastMessage(conv?.lastMessage),
        lastMessageAt: conv?.updatedAt || null,
        isActive: isTeamActive,
        conversationId: conv?.id || null,
        avatarUrl: shelter.logoUrl || this.getDefaultAvatar(shelter.name),
      };
    });

    // Sort: Based on last message time
    list.sort((a, b) => {
      if (a.lastMessageAt === b.lastMessageAt) return 0;
      return a.lastMessageAt ? -1 : 1;
    });

    // Only return contacts with an existing conversation
    const filtered = list.filter((c) => c.conversationId !== null);
    return { list: filtered, total: filtered.length };
  }

  /** ---------------- Helper: load ALL Fosters (not just existing conversations) ---------------- */
  private async loadAllFosters(
    userId: string,
    skip = 0,
    limit = 20,
    search = '',
    userShelterId: string | null = null,
  ): Promise<LoadContactsResult> {
    // Get ALL fosters from the system
    const fosterWhere: Prisma.UserWhereInput = {
      role: 'FOSTER',
      status: 'ACTIVE',
      fosters: {
        status: { in: ['APPROVED', 'PENDING'] },
      },
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [fosters] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where: fosterWhere,
        select: {
          id: true,
          name: true,
          role: true,
          profilePictureId: true,
          profilePictureUrl: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.user.count({ where: fosterWhere }),
    ]);

    // Now fetch existing conversations for these fosters
    const fosterIds = fosters.map((f) => f.id);

    // Build conversation query
    const conversationWhere: Prisma.PrivateConversationWhereInput = {
      chatScope: ConversationScope.MAIN,
      OR: userShelterId
        ? [
            { shelterId: userShelterId, initiatorId: { in: fosterIds } },
            { shelterId: userShelterId, receiverId: { in: fosterIds } },
          ]
        : [
            {
              initiatorId: userId,
              receiverId: { in: fosterIds },
              shelterId: null,
            },
            {
              receiverId: userId,
              initiatorId: { in: fosterIds },
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

    // Create a map of foster conversations
    const convMap = new Map(
      conversations.map((c) => {
        const fosterId = fosterIds.includes(c.initiatorId)
          ? c.initiatorId
          : c.receiverId;
        return [fosterId!, c];
      }),
    );

    // Format the results
    const list: Contact[] = fosters.map((foster) => {
      const conv = convMap.get(foster.id);
      return {
        id: foster.id,
        name: foster.name,
        type: ContactType.FOSTER,
        lastMessage: this.formatLastMessage(conv?.lastMessage),
        lastMessageAt: conv?.updatedAt || null,
        isActive: this.chatGateway.isOnline(foster.id),
        conversationId: conv?.id || null,
        avatarUrl:
          foster.profilePictureUrl || this.getDefaultAvatar(foster.name),
      };
    });

    // Sort: Online first
    list.sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

    // Only return contacts with an existing conversation
    const filtered = list.filter((c) => c.conversationId !== null);
    return { list: filtered, total: filtered.length };
  }

  /** ---------------- Helper: Format last message preview ---------------- */
  private formatLastMessage(message: any): string {
    if (!message) return 'No message yet';

    switch (message.type) {
      case 'IMAGE':
        return '📷 Image';
      case 'VIDEO':
        return '🎥 Video';
      case 'AUDIO':
        return '🎵 Audio';
      case 'FILE':
        return '📄 File';
      case 'VOICE':
        return '🎤 Voice Message';
      default:
        return message.content || '';
    }
  }

  /** ---------------- Helper: Generate default avatar URL based on name ---------------- */
  private getDefaultAvatar(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&size=200`;
  }
}
