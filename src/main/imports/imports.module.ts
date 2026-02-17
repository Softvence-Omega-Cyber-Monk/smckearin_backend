import { Module } from '@nestjs/common';
import { ImportsController } from './controllers/imports.controller';
import { CsvImportService } from './services/csv-import.service';
import { ExternalFeedSyncService } from './services/external-feed-sync.service';
import { MappingTemplateService } from './services/mapping-template.service';

@Module({
  controllers: [ImportsController],
  providers: [
    CsvImportService,
    MappingTemplateService,
    ExternalFeedSyncService,
  ],
  exports: [CsvImportService, ExternalFeedSyncService],
})
export class ImportsModule {}
