import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { GetTransportDto } from '@/main/transport/dto/get-transport.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
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

  @ApiOperation({
    summary: 'Get single health report (All authenticated users)',
  })
  @ValidateAuth()
  @Get(':reportId/single')
  async getSingleHealthReport(@Param('reportId') reportId: string) {
    return this.getHealthReportsService.getSingleHealthReport(reportId);
  }

  @ApiOperation({ summary: "Get veterinarian's health reports (Veterinarian)" })
  @ValidateVeterinarian()
  @Get('veterinarian/list')
  async getVetsHealthReports(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportDto,
  ) {
    return this.getHealthReportsService.getVetsHealthReports(userId, dto);
  }

  @ApiOperation({ summary: 'Get all health reports (Admin)' })
  @ValidateAdmin()
  @Get('list')
  async getAllHealthReports(@Query() dto: GetTransportDto) {
    return this.getHealthReportsService.getAllHealthReports(dto);
  }

  @ApiOperation({ summary: 'Delete health report (Veterinarian & Admin)' })
  @ValidateVeterinarian()
  @Delete(':reportId/delete')
  async deleteHealthReport(
    @Param('reportId') reportId: string,
    @GetUser() authUser: JWTPayload,
  ) {
    return this.manageHealthReportsService.deleteHealthReport(
      reportId,
      authUser,
    );
  }

  @ApiOperation({ summary: 'Approve or reject health report (Admin)' })
  @ValidateAdmin()
  @Post(':reportId/approve-or-reject')
  async approveOrReject(
    @Param('reportId') reportId: string,
    @Body() dto: ApproveOrRejectDto,
  ) {
    return this.manageHealthReportsService.approveOrReject(reportId, dto);
  }
}
