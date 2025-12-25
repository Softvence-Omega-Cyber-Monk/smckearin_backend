import { AppError } from '@/core/error/handle-error.app';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OnboardingStatus } from '@prisma';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
import { InternalTransactionService } from './internal-transaction.service';

@Injectable()
export class DriverPaymentService {
  private readonly logger = new Logger(DriverPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly transactionService: InternalTransactionService,
  ) {}

  /**
   * Creates a Stripe Account Link for driver onboarding.
   * If driver doesn't have a Stripe Connect account yet, one is created.
   */
  async createOnboardingLink(userId: string, dto: CreateOnboardingLinkDto) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver profile not found');
    }

    let accountId = driver.stripeAccountId;
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!accountId) {
      const account = await this.stripeService.createExpressAccount(user.email);
      accountId = account.id;

      await this.prisma.client.driver.update({
        where: { id: driver.id },
        data: {
          stripeAccountId: accountId,
          onboardingStatus: OnboardingStatus.PENDING,
        },
      });
    }

    const link = await this.stripeService.createAccountOnboardingLink(
      accountId,
      dto.refreshUrl,
      dto.returnUrl,
    );

    return { url: link.url };
  }

  /**
   * Creates a login link for the driver's Stripe Express Dashboard.
   */
  async getLoginLink(userId: string) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });

    if (!driver || !driver.stripeAccountId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Driver has no connected Stripe account',
      );
    }

    // Verify if onboarding is complete? Stripe might handle this, but good to check status.
    // For now we assume if they ask for login link, they want to see dashboard.

    const link = await this.stripeService.createLoginLink(
      driver.stripeAccountId,
    );
    return { url: link.url };
  }

  /**
   * Fetches transaction history for the driver from internal records.
   */
  async getTransactionHistory(userId: string) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    // Find all transports by this driver
    const transports = await this.prisma.client.transport.findMany({
      where: { driverId: driver.id },
      select: { id: true },
    });

    const transportIds = transports.map((t) => t.id);

    if (transportIds.length === 0) {
      return [];
    }

    const transactions = await this.prisma.client.transaction.findMany({
      where: { transportId: { in: transportIds } },
      include: {
        transport: {
          select: {
            pickUpLocation: true,
            dropOffLocation: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }
}
