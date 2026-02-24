import { AppError } from '@/core/error/handle-error.app';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateMappingTemplateDto,
  MapCsvDto,
  UpdateMappingTemplateDto,
} from '../dto/imports.dto';
import { CsvImportService } from '../services/csv-import.service';
import { ExternalFeedSyncService } from '../services/external-feed-sync.service';
import { MappingTemplateService } from '../services/mapping-template.service';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly csvImportService: CsvImportService,
    private readonly mappingTemplateService: MappingTemplateService,
    private readonly externalFeedSyncService: ExternalFeedSyncService,
  ) {}

  @Post('csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: MapCsvDto,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'CSV file is required');
    }

    return await this.csvImportService.processCsvFile(
      file,
      dto.mappingTemplateId,
      dto.shelterId,
      dto.idempotencyKey,
    );
  }

  @Get('jobs/shelter/:shelterId')
  async getImportJobs(
    @Param('shelterId') shelterId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.csvImportService.getImportJobs(shelterId, page, limit);
  }

  @Get('jobs/:jobId/shelter/:shelterId')
  async getImportJobDetails(
    @Param('jobId') jobId: string,
    @Param('shelterId') shelterId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.csvImportService.getImportJobDetails(
      jobId,
      shelterId,
      page,
      limit,
    );
  }

  @Post('mapping-templates')
  async createMappingTemplate(@Body() dto: CreateMappingTemplateDto) {
    return await this.mappingTemplateService.createTemplate(dto);
  }

  @Get('mapping-templates/shelter/:shelterId')
  async getMappingTemplates(@Param('shelterId') shelterId: string) {
    return await this.mappingTemplateService.getTemplates(shelterId);
  }

  @Get('mapping-templates/:id/shelter/:shelterId')
  async getMappingTemplate(
    @Param('id') id: string,
    @Param('shelterId') shelterId: string,
  ) {
    return await this.mappingTemplateService.getTemplate(id, shelterId);
  }

  @Put('mapping-templates/:id/shelter/:shelterId')
  async updateMappingTemplate(
    @Param('id') id: string,
    @Param('shelterId') shelterId: string,
    @Body() dto: UpdateMappingTemplateDto,
  ) {
    return await this.mappingTemplateService.updateTemplate(id, shelterId, dto);
  }

  @Delete('mapping-templates/:id/shelter/:shelterId')
  async deleteMappingTemplate(
    @Param('id') id: string,
    @Param('shelterId') shelterId: string,
  ) {
    return await this.mappingTemplateService.deleteTemplate(id, shelterId);
  }

  @Post('sync/:configId')
  async syncFeed(@Param('configId') configId: string) {
    return await this.externalFeedSyncService.syncFeed(configId);
  }
}
