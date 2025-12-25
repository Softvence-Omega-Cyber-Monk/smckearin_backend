import { Module } from '@nestjs/common';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { DriverPaymentController } from './controllers/driver-payment.controller';
import { ShelterPaymentController } from './controllers/shelter-payment.controller';
import { AdminPaymentService } from './services/admin-payment.service';

@Module({
  controllers: [
    AdminPaymentController,
    ShelterPaymentController,
    DriverPaymentController,
  ],
  providers: [AdminPaymentService],
})
export class PaymentModule {}
