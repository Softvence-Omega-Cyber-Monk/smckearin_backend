import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DriverModule } from './driver/driver.module';
import { ShelterModule } from './shelter/shelter.module';
import { UploadModule } from './upload/upload.module';
import { VetModule } from './vet/vet.module';

@Module({
  imports: [AuthModule, DriverModule, VetModule, ShelterModule, UploadModule],
})
export class MainModule {}
