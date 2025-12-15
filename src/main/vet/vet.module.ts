import { Module } from '@nestjs/common';
import { VetController } from './controllers/vet.controller';
import { GetVetService } from './services/get-vet.service';
import { ManageVetService } from './services/manage-vet.service';

@Module({
  controllers: [VetController],
  providers: [GetVetService, ManageVetService],
})
export class VetModule {}
