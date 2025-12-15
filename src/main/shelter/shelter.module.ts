import { Module } from '@nestjs/common';
import { ShelterController } from './controllers/shelter.controller';
import { GetShelterService } from './services/get-shelter.service';
import { ManageShelterService } from './services/manage-shelter.service';

@Module({
  controllers: [ShelterController],
  providers: [GetShelterService, ManageShelterService],
})
export class ShelterModule {}
