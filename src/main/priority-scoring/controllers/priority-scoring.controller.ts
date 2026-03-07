import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PriorityScoringService } from '../services/priority-scoring.service';

@Controller('priority-scoring')
export class PriorityScoringController {
  constructor(
    private readonly priorityScoringService: PriorityScoringService,
  ) {}

  @Get('animals/:id')
  async getAnimalScore(@Param('id') animalId: string) {
    return await this.priorityScoringService.getScore(animalId);
  }

  @Post('recalculate')
  async recalculateScores(@Query('shelterId') shelterId?: string) {
    return await this.priorityScoringService.recalculateAllScores(shelterId);
  }

  @Get('high-priority')
  async getHighPriorityAnimals(
    @Query('threshold') threshold?: number,
    @Query('shelterId') shelterId?: string,
  ) {
    const thresholdValue = threshold ? Number(threshold) : 50;
    return await this.priorityScoringService.getHighPriorityAnimals(
      thresholdValue,
      shelterId,
    );
  }
}
