import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UpdateMedicalStatusDto } from '../dto/medical-readiness.dto';
import { MedicalReadinessService } from '../services/medical-readiness.service';

@Controller('medical-readiness')
export class MedicalReadinessController {
  constructor(
    private readonly medicalReadinessService: MedicalReadinessService,
  ) {}

  @Get('animals/:id')
  async getAnimalReadiness(@Param('id') animalId: string) {
    return await this.medicalReadinessService.getReadiness(animalId);
  }

  @Put('animals/:id')
  async updateMedicalStatus(
    @Param('id') animalId: string,
    @Body() dto: UpdateMedicalStatusDto,
  ) {
    return await this.medicalReadinessService.updateMedicalStatus(
      animalId,
      dto,
    );
  }

  @Get('shelters/:id/cleared-animals')
  async getClearedAnimals(@Param('id') shelterId: string) {
    return await this.medicalReadinessService.getClearedAnimals(shelterId);
  }

  @Post('recalculate')
  async recalculateReadiness(@Query('shelterId') shelterId?: string) {
    return await this.medicalReadinessService.recalculateAllReadiness(
      shelterId,
    );
  }
}
