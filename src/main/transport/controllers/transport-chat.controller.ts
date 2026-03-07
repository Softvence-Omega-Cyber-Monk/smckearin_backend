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
  GetTransportChatMessagesDto,
  MarkTransportChatReadDto,
  SendTransportChatMessageDto,
} from '../dto/transport-chat.dto';
import { TransportChatService } from '../services/transport-chat.service';

@ApiTags('Transport Chat')
@ApiBearerAuth()
@ValidateAuth()
@Controller('transport')
export class TransportChatController {
  constructor(private readonly transportChatService: TransportChatService) {}

  @ApiOperation({ summary: 'Get all ride chat boxes for current user' })
  @Get('chat/my-rides')
  async getMyTransportChats(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportChatMessagesDto,
  ) {
    return this.transportChatService.getMyTransportChats(userId, dto);
  }

  @ApiOperation({ summary: 'Get single ride chat by transport id' })
  @Get(':id/chat')
  async getTransportChat(
    @GetUser('sub') userId: string,
    @Param('id') transportId: string,
    @Query() dto: GetTransportChatMessagesDto,
  ) {
    return this.transportChatService.getTransportChat(userId, transportId, dto);
  }

  @ApiOperation({ summary: 'Send message in ride chat' })
  @Post(':id/chat/message')
  async sendTransportMessage(
    @GetUser('sub') userId: string,
    @Param('id') transportId: string,
    @Body() dto: SendTransportChatMessageDto,
  ) {
    return this.transportChatService.sendTransportMessage(
      userId,
      transportId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Mark ride chat messages as read' })
  @Patch(':id/chat/read')
  async markTransportMessagesRead(
    @GetUser('sub') userId: string,
    @Param('id') transportId: string,
    @Body() dto: MarkTransportChatReadDto,
  ) {
    return this.transportChatService.markTransportMessagesRead(
      userId,
      transportId,
      dto,
    );
  }
}
