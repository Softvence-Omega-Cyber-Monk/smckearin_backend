import { EventsEnum } from '@/common/enum/queue-events.enum';
import { BaseGateway } from '@/core/socket/base.gateway';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { LoadConversationsDto } from './dto/conversation.dto';
import { ConversationQueryService } from './services/conversation-query.service';
import { ConversationSingleQueryService } from './services/conversation-single-query.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:4173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://13.62.62.158:3000',
      'http://13.62.62.158:3001',
      'http://13.62.62.158:3002',
      'http://13.62.62.158:4173',
      'http://13.62.62.158:5173',
      'http://13.62.62.158:5174',
      'https://rescuetransit.ai',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway extends BaseGateway {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly prisma: PrismaService,
    protected readonly jwtService: JwtService,
    private readonly conversationQueryService: ConversationQueryService,
    private readonly conversationSingleQueryService: ConversationSingleQueryService,
  ) {
    super(configService, prisma, jwtService, ChatGateway.name);
  }

  /** ---------------- Conversation Handlers ---------------- */
  @SubscribeMessage(EventsEnum.CONVERSATION_LOAD_LIST)
  async handleLoadConversations(client: Socket, dto: LoadConversationsDto) {
    return this.conversationQueryService.loadConversations(client, dto);
  }

  @SubscribeMessage(EventsEnum.CONVERSATION_LOAD)
  async handleLoadSingleConversation(client: Socket, dto: any) {
    return this.conversationSingleQueryService.loadSingleConversation(
      client,
      dto,
    );
  }

  async emitToShelterTeam(shelterId: string, event: string, data: any) {
    // Find all users who are admins or managers of the shelter
    const teamMembers = await this.prisma.client.user.findMany({
      where: {
        OR: [{ shelterAdminOfId: shelterId }, { managerOfId: shelterId }],
      },
      select: { id: true },
    });

    for (const member of teamMembers) {
      this.emitToUserFirstSocket(member.id, event, data);
    }
  }
}
