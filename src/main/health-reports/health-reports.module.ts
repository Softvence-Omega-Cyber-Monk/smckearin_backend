import { Module } from '@nestjs/common';
import { HealthReportsController } from './controllers/health-reports.controller';
import { GetHealthReportsService } from './services/get-health-reports.service';
import { HealthReportStatsService } from './services/health-reports-stats.service';
import { HealthReportsService } from './services/health-reports.service';
import { ManageHealthReportsService } from './services/manage-health-reports.service';

@Module({
  controllers: [HealthReportsController],
  providers: [
    HealthReportsService,
    GetHealthReportsService,
    ManageHealthReportsService,
    HealthReportStatsService,
  ],
})
export class HealthReportsModule {}
