import { EventsEnum } from '@/common/enum/queue-events.enum';
import { successResponse } from '@/common/utils/response.util';
import { SocketSafe } from '@/core/socket/socket-safe.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { LoadConversationsDto } from '../dto/conversation.dto';

@Injectable()
export class ConversationQueryService {
  private logger = new Logger(ConversationQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hybrid conversation loader:
   * - Without search: Load existing conversations (Chat List).
   * - With search: Load potential contacts (Global Search) + Status of existing conversation.
   */
  @SocketSafe()
  async loadConversations(client: Socket, dto: LoadConversationsDto) {
    const userId = client.data.userId;
    const { page = 1, limit = 20, search, type } = dto;
    const skip = (page - 1) * limit;

    this.logger.debug(
      `Loading conversations for user ${userId}, page ${page}, limit ${limit} and search ${search} type ${dto.type}`,
    );

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const myShelterIds: string[] = [];
    if (user.shelterAdminOfId) myShelterIds.push(user.shelterAdminOfId);
    if (user.managerOfId) myShelterIds.push(user.managerOfId);

    const rawResults: any[] = [];
    let total = 0;

    // PATH 1: NO SEARCH -> Load Existing Conversations Only
    if (!search) {
      const whereClause: any = {};

      // Type Filtering for Chat List
      if (type === 'SHELTER') {
        // Show chats involving a shelter
        whereClause.shelterId = { not: null };
        // Access control
        whereClause.OR = [
          { initiatorId: userId },
          { receiverId: userId },
          ...(myShelterIds.length > 0
            ? [{ shelterId: { in: myShelterIds } }]
            : []),
        ];
      } else if (type === 'DRIVER' || type === 'VET') {
        // Show chats with Users of specific role
        // AND shelterId is null (User-User chat)
        whereClause.shelterId = null;

        const targetRole = type === 'VET' ? 'VETERINARIAN' : 'DRIVER';
        whereClause.OR = [
          { initiatorId: userId, receiver: { role: targetRole } },
          { receiverId: userId, initiator: { role: targetRole } },
        ];
      } else {
        // "All" chats? Or fallback?
        // Load everything where I am involved
        whereClause.OR = [
          { initiatorId: userId },
          { receiverId: userId },
          ...(myShelterIds.length > 0
            ? [{ shelterId: { in: myShelterIds } }]
            : []),
        ];
      }

      const [conversations, count] = await this.prisma.client.$transaction([
        this.prisma.client.privateConversation.findMany({
          where: whereClause,
          include: {
            initiator: this.selectUserPartial(),
            receiver: this.selectUserPartial(),
            shelter: this.selectShelterPartial(),
            lastMessage: {
              include: { sender: { select: { name: true } } }, // Basic sender info
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.client.privateConversation.count({ where: whereClause }),
      ]);

      total = count;

      // Transform to unified format
      conversations.forEach((conv) => {
        const formatted = this.formatConversationResult(
          conv,
          userId,
          myShelterIds,
        );
        // If type filtering was strict (e.g. searching generic users but only wanting those with Driver role),
        // we did that in DB.
        if (formatted) rawResults.push(formatted);
      });
    } else {
      // PATH 2: WITH SEARCH -> Global Search (Users & Shelters)
      // Note: This matches "Entities" and checks if we have a chat.

      // Strategy:
      // 1. Search Users (if not type=SHELTER)
      // 2. Search Shelters (if type=SHELTER or no type)
      // 3. Merge? Pagination is tricky.
      // Simplified: If type provided, search ONLY that table.
      // If NO type provided, we might default to Users or handle both?
      // Given DTO has `type` mainly required? No, checks `if type provided`.

      let foundEntities = [];

      if (type === 'SHELTER') {
        // Search Shelters
        const whereShelter: any = {
          name: { contains: search, mode: 'insensitive' },
        };
        // Exclude my own shelters?
        if (myShelterIds.length > 0) whereShelter.id = { notIn: myShelterIds };

        const [shelters, count] = await this.prisma.client.$transaction([
          this.prisma.client.shelter.findMany({
            where: whereShelter,
            select: {
              id: true,
              name: true,
              logoUrl: true,
              // Check for existing conv
              conversations: {
                where: {
                  OR: [{ initiatorId: userId }, { receiverId: userId }],
                },
                include: {
                  lastMessage: {
                    include: { sender: { select: { name: true } } },
                  },
                },
                take: 1,
              },
            },
            skip,
            take: limit,
            orderBy: { name: 'asc' },
          }),
          this.prisma.client.shelter.count({ where: whereShelter }),
        ]);

        total = count;
        foundEntities = shelters.map((s) => ({
          id: s.id,
          name: s.name,
          image: s.logoUrl,
          type: 'SHELTER',
          existingConv: s.conversations?.[0],
        }));
      } else {
        // Search Users (VET or DRIVER)
        // If type is not provided, maybe search All Users?
        // Let's assume default to searching Users if not Shelter.

        const whereUser: any = {
          name: { contains: search, mode: 'insensitive' },
          id: { not: userId },
        };

        if (type === 'VET') whereUser.role = 'VETERINARIAN';
        if (type === 'DRIVER') whereUser.role = 'DRIVER';

        const [users, count] = await this.prisma.client.$transaction([
          this.prisma.client.user.findMany({
            where: whereUser,
            select: {
              id: true,
              name: true,
              profilePictureId: true,
              role: true,
              // Check for existing conv (User-User or Shelter-User)
              conversationsInitiated: {
                where: { receiverId: userId }, // User-User
                include: {
                  lastMessage: {
                    include: { sender: { select: { name: true } } },
                  },
                },
                take: 1,
              },
              conversationsReceived: {
                where: { initiatorId: userId }, // User-User
                include: {
                  lastMessage: {
                    include: { sender: { select: { name: true } } },
                  },
                },
                take: 1,
              },
              // Checking Shelter-User chats here is hard (I as admin vs User).
              // Let's assume Contact Search is personal for now or strictly User-User.
            },
            skip,
            take: limit,
            orderBy: { name: 'asc' },
          }),
          this.prisma.client.user.count({ where: whereUser }),
        ]);

        total = count;

        foundEntities = users.map((u) => {
          // Find best conversation
          const c1 = u.conversationsInitiated?.[0];
          const c2 = u.conversationsReceived?.[0];
          const existing =
            c1 && c2 ? (c1.updatedAt > c2.updatedAt ? c1 : c2) : c1 || c2;

          return {
            id: u.id,
            name: u.name,
            image: u.profilePictureId,
            type:
              u.role === 'VETERINARIAN'
                ? 'VET'
                : u.role === 'DRIVER'
                  ? 'DRIVER'
                  : 'USER',
            existingConv: existing,
          };
        });
      }

      // Transform Entities to Response Format
      foundEntities.forEach((ent) => {
        rawResults.push({
          id: ent.id, // ID of the Entity (Target)
          name: ent.name,
          type: ent.type,
          image: ent.image, // Optional helper
          lastMessage: ent.existingConv?.lastMessage?.content || 'No chat yet',
          conversationId: ent.existingConv?.id || null, // Helpful for frontend to know if they need to 'create' or 'join'
          isActive: !!ent.existingConv,
          lastActiveAt: ent.existingConv?.updatedAt || null,
        });
      });
    }

    client.emit(
      EventsEnum.CONVERSATION_LIST_RESPONSE,
      successResponse({
        list: rawResults,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
    );

    return successResponse({
      list: rawResults,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  // Helpers
  private selectUserPartial() {
    return {
      select: { id: true, name: true, role: true, profilePictureId: true },
    };
  }

  private selectShelterPartial() {
    return { select: { id: true, name: true, logoUrl: true } };
  }

  private formatConversationResult(
    conv: any,
    userId: string,
    myShelterIds: string[],
  ) {
    // Determine "Other Participant"
    let otherPart: any = null;
    let type = 'USER';

    const isMyShelter = myShelterIds.includes(conv.shelterId || '');

    if (conv.shelterId) {
      if (isMyShelter) {
        // I am Shelter -> Other is User (Initiator or Receiver)
        // Usually Initiator
        otherPart =
          !myShelterIds.includes(conv.initiatorId) && conv.initiatorId
            ? conv.initiator
            : conv.receiver;
        type =
          otherPart?.role === 'VETERINARIAN'
            ? 'VET'
            : otherPart?.role === 'DRIVER'
              ? 'DRIVER'
              : 'USER';
      } else {
        // I am User -> Other is Shelter
        otherPart = conv.shelter;
        type = 'SHELTER';
      }
    } else {
      // User-User
      otherPart = conv.initiatorId === userId ? conv.receiver : conv.initiator;
      type =
        otherPart?.role === 'VETERINARIAN'
          ? 'VET'
          : otherPart?.role === 'DRIVER'
            ? 'DRIVER'
            : 'USER';
    }

    if (!otherPart) return null; // Should not happen

    return {
      id: otherPart.id,
      name: otherPart.name,
      type: type,
      lastMessage: conv.lastMessage?.content || 'Msg',
      isActive: true,
      conversationId: conv.id,
      lastActiveAt: conv.updatedAt,
    };
  }
}
