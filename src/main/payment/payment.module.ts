import { Module } from '@nestjs/common';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { DriverPaymentController } from './controllers/driver-payment.controller';
import { ShelterPaymentController } from './controllers/shelter-payment.controller';
import { AdminPaymentService } from './services/admin-payment.service';
import { DriverPaymentService } from './services/driver-payment.service';
import { InternalTransactionService } from './services/internal-transaction.service';
import { PricingService } from './services/pricing.service';
import { ShelterPaymentService } from './services/shelter-payment.service';

@Module({
  controllers: [
    AdminPaymentController,
    ShelterPaymentController,
    DriverPaymentController,
  ],
  providers: [
    AdminPaymentService,
    PricingService,
    InternalTransactionService,
    DriverPaymentService,
    ShelterPaymentService,
  ],
  exports: [PricingService, InternalTransactionService],
})
export class PaymentModule {}
