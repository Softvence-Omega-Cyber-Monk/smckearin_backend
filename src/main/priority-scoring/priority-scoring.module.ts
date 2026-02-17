import { Module } from '@nestjs/common';
import { PriorityScoringController } from './controllers/priority-scoring.controller';
import { PriorityScoringService } from './services/priority-scoring.service';

@Module({
  controllers: [PriorityScoringController],
  providers: [PriorityScoringService],
  exports: [PriorityScoringService],
})
export class PriorityScoringModule {}
