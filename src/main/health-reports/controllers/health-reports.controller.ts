import { ValidateAuth } from '@/core/jwt/jwt.decorator';
import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetHealthReportsService } from '../services/get-health-reports.service';
import { HealthReportsService } from '../services/health-reports.service';
import { ManageHealthReportsService } from '../services/manage-health-reports.service';

@ApiTags('Health Reports')
@ApiBearerAuth()
@ValidateAuth()
@Controller('health-reports')
export class HealthReportsController {
  constructor(
    private readonly getHealthReportsService: GetHealthReportsService,
    private readonly healthReportsService: HealthReportsService,
    private readonly manageHealthReportsService: ManageHealthReportsService,
  ) {}
}
