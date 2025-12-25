import { Module } from '@nestjs/common';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { DriverPaymentController } from './controllers/driver-payment.controller';
import { ShelterPaymentController } from './controllers/shelter-payment.controller';
import { SubscriptionController } from './controllers/webhook.controller';
import { AdminPaymentService } from './services/admin-payment.service';
import { DriverPaymentService } from './services/driver-payment.service';
import { GetSingleTransactionService } from './services/get-single-transaction.service';
import { HandleWebhookService } from './services/handle-webhook.service';
import { InternalTransactionService } from './services/internal-transaction.service';
import { PayoutService } from './services/payout.service';
import { PricingService } from './services/pricing.service';
import { ShelterPaymentService } from './services/shelter-payment.service';

@Module({
  controllers: [
    SubscriptionController,
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
    HandleWebhookService,
    GetSingleTransactionService,
    PayoutService,
  ],
  exports: [PricingService, InternalTransactionService, PayoutService],
})
export class PaymentModule {}
