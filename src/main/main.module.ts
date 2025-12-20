import { Module } from '@nestjs/common';
import { AnimalModule } from './animal/animal.module';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { HealthReportsModule } from './health-reports/health-reports.module';
import { ShelterModule } from './shelter/shelter.module';
import { StatsModule } from './stats/stats.module';
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
    UploadModule,
  ],
})
export class MainModule {}
