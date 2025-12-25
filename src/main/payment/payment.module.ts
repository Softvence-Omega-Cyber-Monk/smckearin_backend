import { Module } from '@nestjs/common';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { DriverPaymentController } from './controllers/driver-payment.controller';
import { ShelterPaymentController } from './controllers/shelter-payment.controller';
import { AdminPaymentService } from './services/admin-payment.service';
import { InternalTransactionService } from './services/internal-transaction.service';
import { PricingService } from './services/pricing.service';

@Module({
  controllers: [
    AdminPaymentController,
    ShelterPaymentController,
    DriverPaymentController,
  ],
  providers: [AdminPaymentService, PricingService, InternalTransactionService],
  exports: [PricingService, InternalTransactionService],
})
export class PaymentModule {}
