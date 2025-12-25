import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  @HandleError('Failed to process monthly settlement')
  async processMonthlySettlement(triggeredByAdmin = false) {
    this.logger.log('Checking for monthly settlement...');

    // 1. Check if payouts/payments are enabled and it's time
    const settings = await this.prisma.client.paymentSettings.findFirst();

    // Check Global Payment Mode
    if (settings?.paymentMode !== 'PAID') {
      this.logger.log(
        `Payment mode is ${settings?.paymentMode}. Skipping settlement.`,
      );
      return;
    }

    if (!settings?.automaticPayoutsEnabled) {
      this.logger.log('Automatic payouts are disabled. Skipping.');
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();

    if (!triggeredByAdmin && currentDay !== settings.payoutDayOfMonth) {
      this.logger.log(
        `Today is day ${currentDay}, configured payout day is ${settings.payoutDayOfMonth}. Skipping.`,
      );
      return;
    }

    this.logger.log('Starting Monthly Settlement Process...');

    // Phase 1: Charge Shelters for Completed Transports
    await this.chargeShelters();

    // Phase 2: Payout Drivers for Charged Transactions
    await this.payoutDrivers();

    this.logger.log('Monthly settlement process completed.');
  }

  private async chargeShelters() {
    this.logger.log('Phase 1: Charging Shelters...');

    // Find PENDING transactions for COMPLETED transports
    const transactions = await this.prisma.client.transaction.findMany({
      where: {
        status: 'PENDING',
        transport: {
          status: 'COMPLETED',
        },
      },
      include: {
        transport: {
          include: {
            shelter: true,
            pricingSnapshot: true,
          },
        },
      },
    });

    if (transactions.length === 0) {
      this.logger.log('No pending transactions to charge.');
      return;
    }

    // Group by Shelter
    const chargesByShelter = new Map<string, typeof transactions>();
    for (const trx of transactions) {
      const shelterId = trx.transport.shelterId;
      if (!shelterId) continue;

      if (!chargesByShelter.has(shelterId)) {
        chargesByShelter.set(shelterId, []);
      }
      chargesByShelter.get(shelterId)?.push(trx);
    }

    // Process Charges
    for (const [shelterId, shelterTrxs] of chargesByShelter) {
      await this.processShelterCharge(shelterId, shelterTrxs);
    }
  }

  private async processShelterCharge(shelterId: string, transactions: any[]) {
    try {
      const shelter = transactions[0].transport.shelter;
      if (!shelter.stripeCustomerId) {
        this.logger.warn(
          `Shelter ${shelterId} has no Stripe Customer ID. Skipping charge.`,
        );
        return;
      }

      // Calculate Total Amount to Charge
      const totalAmountDollars = transactions.reduce((sum, t) => {
        return sum + (t.transport.pricingSnapshot?.totalRideCost || 0);
      }, 0);

      if (totalAmountDollars <= 0) return;

      const amountCents = Math.round(totalAmountDollars * 100);

      // Create Payment Intent (Charge)
      const paymentIntent = await this.stripeService.createPaymentIntent({
        type: 'transport_payment',
        priceCents: amountCents,
        userId: shelter.id,
        email: shelter.email,
        shelterId,
        transactionCount: transactions.length.toString(),
        period: new Date().toISOString().slice(0, 7),
      });

      // Update Transactions
      const ids = transactions.map((t) => t.id);
      await this.prisma.client.transaction.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'CHARGED', // Funds collected
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      this.logger.log(`Charged Shelter ${shelterId} $${totalAmountDollars}`);
    } catch (error) {
      this.logger.error(`Failed to charge Shelter ${shelterId}`, error);
      // Could mark as FAILED or retry next time
    }
  }

  private async payoutDrivers() {
    this.logger.log('Phase 2: Paying Drivers...');

    // Fetch eligible transactions (CHARGED)
    const transactions = await this.prisma.client.transaction.findMany({
      where: {
        status: 'CHARGED',
        transport: {
          driver: {
            stripeAccountId: { not: null },
          },
        },
      },
      include: {
        transport: {
          include: {
            driver: true,
            pricingSnapshot: true,
          },
        },
      },
    });

    if (transactions.length === 0) {
      this.logger.log('No eligible transactions for payout.');
      return;
    }

    // Group by Driver
    const payoutsByDriver = new Map<string, typeof transactions>();

    for (const trx of transactions) {
      const driverId = trx.transport.driverId;
      if (!driverId) continue;

      if (!payoutsByDriver.has(driverId)) {
        payoutsByDriver.set(driverId, []);
      }
      payoutsByDriver.get(driverId)?.push(trx);
    }

    // Process Payouts
    for (const [driverId, driverTrxs] of payoutsByDriver) {
      await this.processDriverPayout(driverId, driverTrxs);
    }
  }

  private async processDriverPayout(driverId: string, transactions: any[]) {
    try {
      const driver = transactions[0].transport.driver;
      if (!driver.stripeAccountId) return;

      const totalPayoutDollars = transactions.reduce((sum, t) => {
        return sum + (t.transport.pricingSnapshot?.driverGrossPayout || 0);
      }, 0);

      if (totalPayoutDollars <= 0) {
        this.logger.warn(
          `Driver ${driverId} has 0 or negative payout. Skipping.`,
        );
        return;
      }

      const amountCents = Math.round(totalPayoutDollars * 100);

      // Create Transfer
      const transfer = await this.stripeService.createTransfer({
        amountCents,
        destinationAccountId: driver.stripeAccountId,
        metadata: {
          type: 'driver_payout',
          userid: driver.userId,
          driverId,
          transactionCount: transactions.length.toString(),
          period: new Date().toISOString().slice(0, 7), // YYYY-MM
        },
      });

      // Update Transactions to TRANSFERRED
      const ids = transactions.map((t) => t.id);
      await this.prisma.client.transaction.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'TRANSFERRED',
          stripeTransferId: transfer.id,
        },
      });

      this.logger.log(`Paid out $${totalPayoutDollars} to driver ${driverId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process payout for driver ${driverId}`,
        error,
      );
    }
  }

  // Manual Trigger for Admin
  @HandleError('Error manually triggering settlement')
  async triggerSettlement() {
    await this.processMonthlySettlement(true);
    return successResponse(null, 'Settlement process triggered in background');
  }
}
