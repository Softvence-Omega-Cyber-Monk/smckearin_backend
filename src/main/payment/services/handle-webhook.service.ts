import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { Metadata } from '@/lib/stripe/stripe.types';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { Injectable, Logger } from '@nestjs/common';
import { OnboardingStatus, Prisma } from '@prisma';
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

      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        await this.handleAccountDeAuthorized(event.data.object as any);
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
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    this.logger.log(`invoice.${invoice.status}: ${invoice.id}`);

    try {
    } catch (err) {
      throw err;
    }
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    const accountId = account.id;
    this.logger.log(`account.updated for ${accountId}`, {
      payouts_enabled: (account as any).payouts_enabled,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
    });

    try {
      // Find the driver by stripeAccountId
      const driver = await this.prisma.client.driver.findFirst({
        where: { stripeAccountId: accountId },
      });

      if (!driver) {
        this.logger.log(`No driver found for Stripe account ${accountId}`);
        return;
      }

      const payoutsEnabled = !!(account as any).payouts_enabled;
      let newOnboardingStatus = driver.onboardingStatus;

      if (payoutsEnabled) {
        newOnboardingStatus = OnboardingStatus.COMPLETE;
      } else if (account.details_submitted || account.charges_enabled) {
        newOnboardingStatus = OnboardingStatus.PENDING;
      } else {
        newOnboardingStatus = OnboardingStatus.NOT_STARTED;
      }

      // Update DB only if changes
      const updates: Prisma.DriverUpdateInput = {};
      if (driver.payoutEnabled !== payoutsEnabled)
        updates.payoutEnabled = payoutsEnabled;
      if (driver.onboardingStatus !== newOnboardingStatus)
        updates.onboardingStatus = newOnboardingStatus;

      if (Object.keys(updates).length > 0) {
        await this.prisma.client.driver.update({
          where: { id: driver.id },
          data: updates,
        });

        this.logger.log(
          `Updated driver ${driver.id} with ${JSON.stringify(updates)}`,
        );
      } else {
        this.logger.log(`No driver update required for ${driver.id}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to process account.updated for ${accountId}`,
        err,
      );
      throw err;
    }
  }

  private async handleAccountDeAuthorized(obj: any) {
    const accountId = obj.account ?? obj.id;
    this.logger.warn(`account.application.deauthorized for ${accountId}`);

    try {
      const driver = await this.prisma.client.driver.findFirst({
        where: { stripeAccountId: accountId },
      });

      if (!driver) {
        this.logger.log(`No driver found for Stripe account ${accountId}`);
        return;
      }

      await this.prisma.client.driver.update({
        where: { id: driver.id },
        data: {
          payoutEnabled: false,
          onboardingStatus: OnboardingStatus.NOT_STARTED,
        },
      });

      this.logger.log(
        `Driver ${driver.id} updated: payoutEnabled=false, onboardingStatus=NOT_STARTED`,
      );
    } catch (err) {
      this.logger.error('Error handling account.application.deauthorized', err);
      throw err;
    }
  }
}
