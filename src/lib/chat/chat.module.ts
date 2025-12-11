import { Global, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ConversationMutationService } from './services/conversation-mutation.service';
import { ConversationQueryService } from './services/conversation-query.service';
import { MessageService } from './services/message.service';

@Global()
@Module({
  providers: [
    ChatGateway,
    MessageService,
    ConversationQueryService,
    ConversationMutationService,
  ],
})
export class ChatModule {}
