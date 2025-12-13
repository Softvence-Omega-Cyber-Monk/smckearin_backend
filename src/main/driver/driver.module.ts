import { Module } from '@nestjs/common';
import { DriverController } from './controllers/driver.controller';
import { GetDriverService } from './services/get-driver.service';
import { ManageDriverService } from './services/manage-driver.service';

@Module({
  controllers: [DriverController],
  providers: [GetDriverService, ManageDriverService],
})
export class DriverModule {}
