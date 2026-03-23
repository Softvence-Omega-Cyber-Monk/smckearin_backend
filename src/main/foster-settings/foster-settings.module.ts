import { Module } from '@nestjs/common';
import { FosterSettingsController } from './foster-settings.controller';
import { FosterSettingsService } from './foster-settings.service';

@Module({
  controllers: [FosterSettingsController],
  providers: [FosterSettingsService],
})
export class FosterSettingsModule {}
