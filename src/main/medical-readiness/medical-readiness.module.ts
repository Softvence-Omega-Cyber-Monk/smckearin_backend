import { Module } from '@nestjs/common';
import { MedicalReadinessController } from './controllers/medical-readiness.controller';
import { MedicalReadinessService } from './services/medical-readiness.service';

@Module({
  controllers: [MedicalReadinessController],
  providers: [MedicalReadinessService],
  exports: [MedicalReadinessService],
})
export class MedicalReadinessModule {}
