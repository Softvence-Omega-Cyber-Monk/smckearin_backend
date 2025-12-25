import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { Metadata } from '@/lib/stripe/stripe.types';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class HandleWebhookService {
  private readonly logger = new Logger(HandleWebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to handle Stripe webhook', 'Subscription')
  async handleWebhook(signature: string, rawBody: Buffer) {
    // 1. Verify webhook signature
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);

      this.logger.log(`Received Stripe event: ${event.type}`);

      // 2. Process the event
      await this.handleEvent(event);
    } catch (error) {
      this.logger.error('Webhook  failed', error);
      throw new AppError(400, 'Invalid webhook signature');
    }
  }

  private async handleEvent(event: Stripe.Event) {
    this.logger.log(
      `Received Stripe event: ${event.type}`,
      JSON.stringify(event, null, 2),
    );

    switch (event.type) {
      case 'setup_intent.succeeded':
        await this.handleSetupIntentSucceeded(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      case 'setup_intent.setup_failed':
      case 'setup_intent.canceled':
        await this.handleSetupIntentFailed(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
    const transactionId = setupIntent.id;
    const metadata = setupIntent.metadata as unknown as Metadata;
    const customerId = setupIntent.customer as string;
    const paymentMethodId = setupIntent.payment_method as string;

    this.logger.log(`setup_intent.${setupIntent.status}: ${transactionId}`, {
      metadata,
      customerId,
      paymentMethodId,
    });

    try {
      if (customerId && paymentMethodId) {
        await this.stripeService.setDefaultPaymentMethod(
          customerId,
          paymentMethodId,
        );
        this.logger.log(
          `Updated default payment method for customer ${customerId}`,
        );

        const user = await this.prisma.client.user.findUnique({
          where: { id: metadata.userId },
        });

        if (!user) {
          throw new Error('User profile not found');
        }

        const shelterId = user.shelterAdminOfId ?? user.managerOfId;
        if (!shelterId) {
          throw new Error('User does not belong to any shelter');
        }

        await this.prisma.client.shelter.update({
          where: { id: shelterId },
          data: {
            stripeCustomerId: customerId,
            stripeDefaultPaymentMethodId: paymentMethodId,
          },
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to update default payment method for ${customerId}`,
        err,
      );
      throw err;
    }
  }

  private async handleSetupIntentFailed(setupIntent: Stripe.SetupIntent) {
    const transactionId = setupIntent.id;
    const customerId = setupIntent.customer as string;
    const error = setupIntent.last_setup_error;

    this.logger.warn(
      `setup_intent.${setupIntent.status}: ${transactionId} for customer ${customerId}`,
    );

    if (error) {
      this.logger.error(
        `Setup Intent Failed: ${error.code} - ${error.message}`,
        JSON.stringify(error),
      );
    }

    // Optional: Could notify user via notification service if implemented
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    this.logger.log(`invoice.${invoice.status}: ${invoice.id}`);

    try {
    } catch (err) {
      throw err;
    }
  }
}
