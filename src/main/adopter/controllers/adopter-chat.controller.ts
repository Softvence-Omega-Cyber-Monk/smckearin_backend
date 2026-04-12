import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetAdoptionChatMessagesDto,
  MarkAdoptionChatReadDto,
  SendAdoptionChatMessageDto,
} from '../dto/adopter-chat.dto';
import { AdopterService } from '../services/adopter.service';
import { ConversationSingleQueryService } from '@/lib/chat/services/conversation-single-query.service';
import { MessageService } from '@/lib/chat/services/message.service';
import { ConversationType } from '@/lib/chat/dto/conversation.dto';
import { ConversationQueryService } from '@/lib/chat/services/conversation-query.service';

@ApiTags('Adoption Chat')
@ApiBearerAuth()
@ValidateAuth()
@Controller('adopter/chat')
export class AdopterChatController {
  constructor(
    private readonly conversationQueryService: ConversationQueryService,
    private readonly conversationSingleQueryService: ConversationSingleQueryService,
    private readonly messageService: MessageService,
  ) {}

  @ApiOperation({ summary: 'Get all adoption conversations for current user' })
  @Get('list')
  async getAdoptionConversations(
    @GetUser('sub') userId: string,
    @Query() dto: GetAdoptionChatMessagesDto,
  ) {
    return this.conversationQueryService.loadConversations(
      {
        data: { userId },
      } as any,
      { ...dto, type: ConversationType.ADOPTION },
    );
  }

  @ApiOperation({ summary: 'Init or load single adoption chat by adoption id' })
  @Get(':adoptionId')
  async getAdoptionChat(
    @GetUser('sub') userId: string,
    @Param('adoptionId') adoptionId: string,
    @Query() dto: GetAdoptionChatMessagesDto,
  ) {
    return this.conversationSingleQueryService.loadSingleConversation(
      {
        data: { userId },
      } as any,
      {
        id: adoptionId,
        type: ConversationType.ADOPTION,
        page: dto.page,
        limit: dto.limit,
      },
    );
  }
}
