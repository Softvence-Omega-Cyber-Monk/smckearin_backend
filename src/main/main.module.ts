import { Module } from '@nestjs/common';
import { AnimalModule } from './animal/animal.module';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { ShelterModule } from './shelter/shelter.module';
import { StatsModule } from './stats/stats.module';
import { TransportModule } from './transport/transport.module';
import { UploadModule } from './upload/upload.module';
import { VetModule } from './vet/vet.module';
import { HealthReportsModule } from './health-reports/health-reports.module';

@Module({
  imports: [
    AuthModule,
    DriverModule,
    VetModule,
    ShelterModule,
    AnimalModule,
    TransportModule,
    StatsModule,
    HealthReportsModule,
    UploadModule,
  ],
})
export class MainModule {}
