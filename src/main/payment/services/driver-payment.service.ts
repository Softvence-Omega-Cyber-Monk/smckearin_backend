import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';

@Injectable()
export class DriverPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  @HandleError('Failed to create onboarding link')
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

    const payload = { url: link.url };

    return successResponse(payload, 'Onboarding link created successfully');
  }

  @HandleError('Failed to get login link')
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

    const link = await this.stripeService.createLoginLink(
      driver.stripeAccountId,
    );
    const payload = { url: link.url };

    return successResponse(payload, 'Login link created successfully');
  }

  @HandleError('Failed to get transaction history')
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
      return successResponse([], 'No transactions found');
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

    return successResponse(transactions, 'Transactions fetched');
  }
}
