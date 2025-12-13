import { Module } from '@nestjs/common';
import { AdminDriverModule } from './controllers/admin-driver.module';
import { GetDriverService } from './services/get-driver.service';

@Module({
  imports: [AdminDriverModule],
  providers: [GetDriverService],
})
export class DriverModule {}
