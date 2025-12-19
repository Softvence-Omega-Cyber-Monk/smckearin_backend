import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { AdminStatsService } from './services/admin-stats.service';
import { ShelterStatsService } from './services/shelter-stats.service';
import { DriverStatsService } from './services/driver-stats.service';
import { VetStatsService } from './services/vet-stats.service';

@Module({
  controllers: [StatsController],
  providers: [
    AdminStatsService,
    ShelterStatsService,
    DriverStatsService,
    VetStatsService,
  ],
})
export class StatsModule {}
