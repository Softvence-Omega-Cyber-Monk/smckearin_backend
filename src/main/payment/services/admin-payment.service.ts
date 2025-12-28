import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ComplexityType, TransactionStatus } from '@prisma';
import { TransactionWhereInput } from 'prisma/generated/models';
import {
  UpdateComplexityFeeDto,
  UpdatePaymentSettingsDto,
  UpdatePricingRuleDto,
} from '../dto/admin-payment.dto';
import {
  DetailedTransactionDto,
  GetTransactionDto,
} from '../dto/get-transaction.dto';

@Injectable()
export class AdminPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Error getting payment settings')
  async getSettings() {
    let settings = await this.prisma.client.paymentSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.client.paymentSettings.create({
        data: {
          driverPaymentsEnabled: false,
          platformFeesEnabled: false,
          timeBasedPricingEnabled: false,
        },
      });
    }

    return successResponse(settings, 'Payment settings fetched');
  }

  @HandleError('Error updating payment settings')
  async updateSettings(dto: UpdatePaymentSettingsDto) {
    const { data: currentSettings } = await this.getSettings();

    const updated = await this.prisma.client.paymentSettings.update({
      where: { id: currentSettings.id },
      data: { ...dto },
    });

    return successResponse(updated, 'Payment settings updated');
  }

  @HandleError('Error fetching current pricing rule')
  async getCurrentPricingRule() {
    const rule = await this.prisma.client.pricingRule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(rule, 'Latest pricing rule fetched');
  }

  @HandleError('Error creating pricing rule')
  async createPricingRule(dto: UpdatePricingRuleDto) {
    const { data: current } = await this.getCurrentPricingRule();
    const nextVersion = (current?.calculationVersion || 0) + 1;

    const rule = await this.prisma.client.pricingRule.create({
      data: {
        ...dto,
        calculationVersion: nextVersion,
        effectiveDate: new Date(),
      },
    });

    return successResponse(rule, 'Pricing rule created');
  }

  @HandleError('Error fetching complexity fees')
  async getComplexityFees() {
    const fees = await this.prisma.client.animalComplexityFee.findMany({
      orderBy: { amount: 'asc' },
    });

    return successResponse(fees, 'Complexity fees fetched');
  }

  @HandleError('Error updating complexity fee')
  async updateComplexityFee(type: ComplexityType, dto: UpdateComplexityFeeDto) {
    const fee = await this.prisma.client.animalComplexityFee.findUnique({
      where: { type },
    });

    if (!fee) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        `Complexity type ${type} not found`,
      );
    }

    const updated = await this.prisma.client.animalComplexityFee.update({
      where: { id: fee.id },
      data: {
        amount: dto.amount,
        multiAnimalFlatFee: dto.multiAnimalFlatFee,
      },
    });

    return successResponse(updated, 'Complexity fee updated');
  }

  @HandleError('Error fetching transactions')
  async getTransactions(
    dto: GetTransactionDto,
  ): Promise<TPaginatedResponse<DetailedTransactionDto>> {
    const { limit, page, skip } = this.utils.getPagination(dto);

    const where: TransactionWhereInput = {
      ...(dto.status && { status: dto.status }),
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

    // Map to DetailedTransactionDto
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

  @HandleError('Error fetching payment stats')
  async getPaymentStats() {
    const stats = await this.prisma.client.$transaction(async (tx) => {
      // Transaction Counts and Sums by Status
      const transactions = await tx.transaction.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amount: true },
      });

      const totalTransactions = transactions.reduce(
        (sum, t) => sum + t._count.id,
        0,
      );

      const pendingTransactions =
        transactions.find((t) => t.status === 'PENDING')?._count.id || 0;
      const completedTransactions =
        transactions.find((t) => t.status === 'TRANSFERRED')?._count.id || 0;
      const failedTransactions =
        transactions.find((t) => t.status === 'FAILED')?._count.id || 0;

      // Revenue: Total charged to shelters
      const totalRevenue = transactions
        .filter((t) =>
          ['CHARGED', 'TRANSFERRED', 'PROCESSING'].includes(t.status),
        )
        .reduce((sum, t) => sum + (t._sum.amount || 0), 0);

      // Detailed Metrics from Pricing Snapshots
      const completedTransports = await tx.transport.findMany({
        where: {
          transaction: {
            status: { in: ['CHARGED', 'TRANSFERRED', 'PROCESSING'] },
          },
        },
        include: { pricingSnapshot: true },
      });

      const totalDriverPayouts = completedTransports.reduce(
        (sum, t) => sum + (t.pricingSnapshot?.driverGrossPayout || 0),
        0,
      );

      const totalPlatformFees = completedTransports.reduce(
        (sum, t) => sum + (t.pricingSnapshot?.platformFeeAmount || 0),
        0,
      );

      const totalMiles = completedTransports.reduce(
        (sum, t) => sum + (t.pricingSnapshot?.distanceMiles || 0),
        0,
      );

      const totalRides = await tx.transport.count();
      const activeRides = await tx.transport.count({
        where: { status: { in: ['ACCEPTED', 'IN_TRANSIT', 'PICKED_UP'] } },
      });

      // Monthly breakdown for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyData = await tx.transaction.findMany({
        where: {
          createdAt: { gte: sixMonthsAgo },
          status: { in: ['CHARGED', 'TRANSFERRED', 'PROCESSING'] },
        },
        include: {
          transport: {
            include: { pricingSnapshot: true },
          },
        },
      });

      const monthlyBreakdown = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const monthLabel = d.toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        });
        const month = d.getMonth();
        const year = d.getFullYear();

        const monthTransactions = monthlyData.filter((t) => {
          const tDate = new Date(t.createdAt);
          return tDate.getMonth() === month && tDate.getFullYear() === year;
        });

        return {
          month: monthLabel,
          revenue: monthTransactions.reduce((sum, t) => sum + t.amount, 0),
          payouts: monthTransactions.reduce(
            (sum, t) =>
              sum + (t.transport.pricingSnapshot?.driverGrossPayout || 0),
            0,
          ),
          count: monthTransactions.length,
        };
      });

      return {
        totalRevenue,
        totalDriverPayouts,
        totalPlatformFees,
        totalTransactions,
        pendingTransactions,
        completedTransactions,
        failedTransactions,
        totalMiles,
        totalRides,
        activeRides,
        monthlyBreakdown,
      };
    });

    return successResponse(stats, 'Payment stats fetched');
  }

  @HandleError('Error toggling hold status for transaction')
  async toggleHoldTransaction(transactionId: string) {
    // Fetch existing transaction
    const transaction = await this.prisma.client.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    const allowedStatuses = ['PENDING', 'HOLD'] as TransactionStatus[];

    // Reject if status is not toggle able
    if (!allowedStatuses.includes(transaction.status)) {
      return successResponse(
        transaction,
        `Transaction cannot be hold or un hold when status is '${transaction.status}'`,
      );
    }

    // Determine next status
    const isCurrentlyOnHold = transaction.status === 'HOLD';
    const newStatus = isCurrentlyOnHold ? 'PENDING' : 'HOLD';

    // Update
    const updated = await this.prisma.client.transaction.update({
      where: { id: transactionId },
      data: { status: newStatus },
    });

    return successResponse(
      updated,
      isCurrentlyOnHold
        ? 'Transaction removed from hold'
        : 'Transaction put on hold',
    );
  }
}
