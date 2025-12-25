import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OnboardingStatus } from '@prisma';
import { TransactionWhereInput } from 'prisma/generated/models';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
import {
  DetailedTransactionDto,
  GetTransactionDto,
} from '../dto/get-transaction.dto';

@Injectable()
export class DriverPaymentService {
  private readonly logger = new Logger(DriverPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to get driver payout status')
  async getPayoutStatus(userId: string) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    // Base payload from DB
    const payload: any = {
      stripeAccountId: driver.stripeAccountId ?? null,
      onboardingStatus: driver.onboardingStatus,
      payoutEnabled: driver.payoutEnabled,
    };

    if (driver.stripeAccountId) {
      try {
        const account = await this.stripeService.retrieveAccount(
          driver.stripeAccountId,
        );

        this.logger.log(
          `Retrieved Stripe account ${driver.stripeAccountId}`,
          JSON.stringify(account, null, 2),
        );

        payload.stripeAccount = {
          id: account.id,
          business_type: account.business_type,
          country: account.country,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled ?? false,
          requirements: account.requirements,
          capabilities: account.capabilities,
        };

        // Optional: sync DB if live Stripe info differs
        const newOnboardingStatus = account.details_submitted
          ? OnboardingStatus.COMPLETE
          : OnboardingStatus.PENDING;

        if (
          driver.onboardingStatus !== newOnboardingStatus ||
          driver.payoutEnabled !== account.payouts_enabled
        ) {
          await this.prisma.client.driver.update({
            where: { id: driver.id },
            data: {
              onboardingStatus: newOnboardingStatus,
              payoutEnabled: account.payouts_enabled,
            },
          });

          // Update payload to reflect synced DB
          payload.onboardingStatus = newOnboardingStatus;
          payload.payoutEnabled = account.payouts_enabled;
        }
      } catch (err) {
        this.logger?.warn(
          `Failed to fetch Stripe account ${driver.stripeAccountId}: ${err}`,
        );
        // Keep payload from DB if Stripe is temporarily unavailable
      }
    }

    return successResponse(payload, 'Driver payout status retrieved');
  }

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
  async getTransactionHistory(userId: string, dto: GetTransactionDto) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    const { limit, page, skip } = this.utils.getPagination(dto);

    const where: TransactionWhereInput = {
      ...(dto.status && { status: dto.status }),
      transport: { driverId: driver.id },
    };

    const [transactions, total] = await this.prisma.client.$transaction([
      this.prisma.client.transaction.findMany({
        where,
        include: {
          transport: {
            include: {
              pricingSnapshot: true,
              animal: true,
              driver: {
                include: { user: true },
              },
              shelter: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.transaction.count({ where }),
    ]);

    // Map results to DetailedTransactionDto
    const flattenedTransactions: DetailedTransactionDto[] = transactions.map(
      (t) => {
        const snap = t.transport.pricingSnapshot;
        return {
          id: t.id,
          status: t.status,
          amount: t.amount,
          currency: t.currency,
          createdAt: t.createdAt,
          completedAt: t.transport.completedAt,

          transportId: t.transportId,
          transportDate: t.transport.transPortDate,
          pickupLocation: t.transport.pickUpLocation,
          dropOffLocation: t.transport.dropOffLocation,
          distanceMiles: snap?.distanceMiles || 0,
          durationMinutes: snap?.durationMinutes || 0,

          driverId: t.transport.driverId,
          driverName: t.transport.driver?.user?.name || 'Me',

          shelterId: t.transport.shelterId,
          shelterName: t.transport.shelter?.name || 'Unknown',

          animalName: t.transport.animal?.name || 'Unknown',

          ratePerMile: snap?.ratePerMile || 0,
          ratePerMinute: snap?.ratePerMinute || 0,
          distanceCost: snap?.distanceCost || 0,
          timeCost: snap?.timeCost || 0,
          complexityFee:
            (snap?.animalComplexityFee || 0) + (snap?.multiAnimalFee || 0),
          platformFee: snap?.platformFeeAmount || 0,
          driverPayout: snap?.driverGrossPayout || 0,
          totalCost: snap?.totalRideCost || 0,
        };
      },
    );

    return successPaginatedResponse(
      flattenedTransactions,
      { page, limit, total },
      'Transaction history fetched successfully',
    );
  }
}
