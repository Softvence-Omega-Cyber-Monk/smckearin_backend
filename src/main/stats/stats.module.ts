import { Module } from '@nestjs/common';
import { AdminGraphStatsService } from './services/admin-graph-stats.service';
import { AdminStatsService } from './services/admin-stats.service';
import { DriverStatsService } from './services/driver-stats.service';
import { ShelterGraphStatsService } from './services/shelter-graph-stats.service';
import { ShelterStatsService } from './services/shelter-stats.service';
import { VetGraphStatsService } from './services/vet-graph-stats.service';
import { VetStatsService } from './services/vet-stats.service';
import { StatsController } from './stats.controller';

@Module({
  controllers: [StatsController],
  providers: [
    AdminStatsService,
    AdminGraphStatsService,
    ShelterStatsService,
    DriverStatsService,
    VetStatsService,
    VetGraphStatsService,
    ShelterGraphStatsService,
  ],
})
export class StatsModule {}
