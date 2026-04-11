import { Module } from '@nestjs/common';
import { AdopterController } from './controllers/adopter.controller';
import { AdopterService } from './services/adopter.service';

@Module({
  controllers: [AdopterController],
  providers: [AdopterService],
})
export class AdopterModule {}
