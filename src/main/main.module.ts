import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [AuthModule, UploadModule, DriverModule, AdminModule],
})
export class MainModule {}
