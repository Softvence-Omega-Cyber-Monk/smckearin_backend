import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [AuthModule, DriverModule, UploadModule],
})
export class MainModule {}
