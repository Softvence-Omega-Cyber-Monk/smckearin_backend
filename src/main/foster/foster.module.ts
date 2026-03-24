import { Module } from '@nestjs/common';
import { FosterController } from './controllers/foster.controller';
import { GetFosterService } from './services/get-foster.service';
import { ManageFosterService } from './services/manage-foster.service';

@Module({
  controllers: [FosterController],
  providers: [GetFosterService, ManageFosterService],
})
export class FosterModule {}
