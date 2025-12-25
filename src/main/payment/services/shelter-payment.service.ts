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
import { TransactionWhereInput } from 'prisma/generated/models';
import {
  DetailedTransactionDto,
  GetTransactionDto,
} from '../dto/get-transaction.dto';

@Injectable()
export class ShelterPaymentService {
  private readonly logger = new Logger(ShelterPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to create setup intent')
  async createSetupIntent(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User profile not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    // Shelter doesn't have direct userId connection usually, it's via admins/managers
    const shelter = await this.prisma.client.shelter.findFirst({
      where: { id: shelterId },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter profile not found');
    }

    if (shelter.stripeDefaultPaymentMethodId) {
      return successResponse(
        {
          alreadyAdded: true,
          message: 'Payment method already exists. Remove it first.',
        },
        'Payment method exists',
      );
    }

    const setupIntent = await this.stripeService.createSetupIntent({
      email: user.email,
      name: shelter.name,
      userId: user.id,
      type: 'shelter_connect',
    });

    // If shelter doesn't have stripeCustomerId, update it
    if (!shelter.stripeCustomerId && setupIntent.customer) {
      await this.prisma.client.shelter.update({
        where: { id: shelter.id },
        data: { stripeCustomerId: setupIntent.customer as string },
      });
    }

    return successResponse(
      {
        alreadyAdded: false,
        clientSecret: setupIntent.client_secret,
        customerId: setupIntent.customer,
      },
      'Setup intent created successfully',
    );
  }

  @HandleError('Failed to list payment methods')
  async listPaymentMethods(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User profile not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const shelter = await this.prisma.client.shelter.findFirst({
      where: { id: shelterId },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    const hasPaymentMethod = !!shelter.stripeDefaultPaymentMethodId;

    let pm: any;
    if (shelter.stripeDefaultPaymentMethodId) {
      pm = await this.stripeService.getPaymentMethodDetails(
        shelter.stripeDefaultPaymentMethodId,
      );
    }

    let paymentMethod: any;

    if (pm) {
      paymentMethod = {
        id: pm.id,
        type: pm.type,
        card: pm.card,
      };
    }
    const payload = {
      hasPaymentMethod,
      ...(hasPaymentMethod && { paymentMethod }),
    };

    return successResponse(payload, 'Payment method status retrieved');
  }

  @HandleError('Failed to remove payment method')
  async removePaymentMethod(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const shelter = await this.prisma.client.shelter.findFirst({
      where: { id: shelterId },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    if (!shelter.stripeDefaultPaymentMethodId) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'No payment method to remove');
    }

    // Detach in Stripe
    await this.stripeService.detachPaymentMethod(
      shelter.stripeDefaultPaymentMethodId,
    );

    // Delete from DB
    await this.prisma.client.shelter.update({
      where: { id: shelter.id },
      data: { stripeDefaultPaymentMethodId: null },
    });

    return successResponse({}, 'Payment method removed successfully');
  }

  @HandleError('Failed to get transaction history')
  async getTransactionHistory(userId: string, dto: GetTransactionDto) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User profile not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const shelter = await this.prisma.client.shelter.findFirst({
      where: { id: shelterId },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    const { limit, page, skip } = this.utils.getPagination(dto);

    const where: TransactionWhereInput = {
      ...(dto.status && { status: dto.status }),
      transport: { shelterId },
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
          driverName: t.transport.driver?.user?.name || 'Unknown',

          shelterId: t.transport.shelterId,
          shelterName: t.transport.shelter?.name || 'Me',

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
