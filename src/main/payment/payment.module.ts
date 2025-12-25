import { Module } from '@nestjs/common';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { ShelterPaymentController } from './controllers/shelter-payment.controller';
import { DriverPaymentController } from './controllers/driver-payment.controller';

@Module({
  controllers: [
    AdminPaymentController,
    ShelterPaymentController,
    DriverPaymentController,
  ],
})
export class PaymentModule {}
