import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { StripeService } from '@/lib/stripe/stripe.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma';
import { TransactionWhereInput } from 'prisma/generated/models';
import { CreateOnboardingLinkDto } from '../dto/driver-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';

@Injectable()
export class DriverPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly utils: UtilsService,
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
              driver: true,
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

    return successPaginatedResponse(
      transactions,
      { page, limit, total },
      'Transaction history fetched successfully',
    );
  }
}
