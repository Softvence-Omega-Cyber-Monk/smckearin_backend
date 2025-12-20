import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAuth,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateHealthReportDto } from '../dto/health-report.dto';
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

  @ApiOperation({ summary: 'Create health report (Veterinarian)' })
  @ValidateVeterinarian()
  @ApiConsumes('multipart/form-data')
  @Post('veterinarian/create')
  @UseInterceptors(FileInterceptor('report'))
  async createHealthReport(
    @GetUser('sub') userId: string,
    @Body() dto: CreateHealthReportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'File is required');
    }

    dto.report = file;

    return this.healthReportsService.createHealthReport(userId, dto);
  }
}
