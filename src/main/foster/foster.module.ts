import { Module } from '@nestjs/common';
import { FosterController } from './controllers/foster.controller';
import { FosterAnimalService } from './services/foster-animal.service';
import { GetFosterService } from './services/get-foster.service';
import { ManageFosterAnimalInterestService } from './services/manage-foster-animal-interest.service';
import { ManageFosterService } from './services/manage-foster.service';
import { ShelterFosterRequestService } from './services/shelter-foster-request.service';

@Module({
  controllers: [FosterController],
  providers: [
    GetFosterService,
    ManageFosterService,
    FosterAnimalService,
    ManageFosterAnimalInterestService,
    ShelterFosterRequestService,
  ],
})
export class FosterModule {}
