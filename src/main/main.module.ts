import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { DriverModule } from './driver/driver.module';

@Module({
  imports: [AuthModule, UploadModule, DriverModule],
})
export class MainModule {}
