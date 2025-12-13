import { Module } from '@nestjs/common';
import { DriverController } from './controllers/driver.controller';
import { GetDriverService } from './services/get-driver.service';

@Module({
  imports: [DriverController],
  providers: [GetDriverService],
})
export class DriverModule {}
