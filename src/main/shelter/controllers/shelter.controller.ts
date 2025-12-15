import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetShelterService } from '../services/get-shelter.service';
import { ManageShelterService } from '../services/manage-shelter.service';

@ApiTags('Shelter')
@Controller('shelter')
export class ShelterController {
  constructor(
    private readonly getShelterService: GetShelterService,
    private readonly manageShelterService: ManageShelterService,
  ) {}
}
