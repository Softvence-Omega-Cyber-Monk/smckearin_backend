import { Module } from '@nestjs/common';
import { AdopterController } from './controllers/adopter.controller';
import { AdopterChatController } from './controllers/adopter-chat.controller';
import { AdopterService } from './services/adopter.service';

@Module({
  controllers: [AdopterController, AdopterChatController],
  providers: [AdopterService],
})
export class AdopterModule {}
