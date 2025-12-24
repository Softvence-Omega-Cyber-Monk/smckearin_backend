import { Global, Module } from '@nestjs/common';
import { FileService } from './services/file.service';
import { PaymentSeedService } from './services/payment-seed.service';
import { SuperAdminService } from './services/super-admin.service';

@Global()
@Module({
  imports: [],
  providers: [SuperAdminService, FileService, PaymentSeedService],
})
export class SeedModule {}
