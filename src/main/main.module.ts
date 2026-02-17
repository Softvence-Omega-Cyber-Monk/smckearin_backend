import { Module } from '@nestjs/common';
import { AnimalModule } from './animal/animal.module';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { HealthReportsModule } from './health-reports/health-reports.module';
import { ImportsModule } from './imports/imports.module';
import { MedicalReadinessModule } from './medical-readiness/medical-readiness.module';
import { PaymentModule } from './payment/payment.module';
import { PriorityScoringModule } from './priority-scoring/priority-scoring.module';
import { ShelterModule } from './shelter/shelter.module';
import { StatsModule } from './stats/stats.module';
import { TransportOptimizerModule } from './transport-optimizer/transport-optimizer.module';
import { TransportModule } from './transport/transport.module';
import { UploadModule } from './upload/upload.module';
import { VetClearanceAppointmentModule } from './vet-clearance-appointment/vet-clearance-appointment.module';
import { VetModule } from './vet/vet.module';

@Module({
  imports: [
    AuthModule,
    DriverModule,
    VetModule,
    ShelterModule,
    AnimalModule,
    TransportModule,
    HealthReportsModule,
    VetClearanceAppointmentModule,
    StatsModule,
    PaymentModule,
    UploadModule,
    // Rescue Transit AI Modules
    ImportsModule,
    MedicalReadinessModule,
    PriorityScoringModule,
    TransportOptimizerModule,
  ],
})
export class MainModule {}
