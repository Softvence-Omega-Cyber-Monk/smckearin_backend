import { PrismaService } from '@/lib/prisma/prisma.service';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ChatGateway } from '../chat.gateway';

@Injectable()
export class ConversationMutationService {
  private logger = new Logger(ConversationMutationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  
}
