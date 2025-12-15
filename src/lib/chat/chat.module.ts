import { Global, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ConversationQueryService } from './services/conversation-query.service';
import { ConversationSingleQueryService } from './services/conversation-single-query.service';
import { MessageService } from './services/message.service';

@Global()
@Module({
  providers: [
    ChatGateway,
    MessageService,
    ConversationQueryService,
    ConversationSingleQueryService,
  ],
})
export class ChatModule {}
