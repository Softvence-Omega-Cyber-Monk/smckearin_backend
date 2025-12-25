import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ComplexityType } from '@prisma';
import { TransactionWhereInput } from 'prisma/generated/models';
import {
  UpdateComplexityFeeDto,
  UpdatePaymentSettingsDto,
  UpdatePricingRuleDto,
} from '../dto/admin-payment.dto';
import { GetTransactionDto } from '../dto/get-transaction.dto';

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
  async getTransactions(dto: GetTransactionDto) {
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

  @HandleError('Error fetching payment stats')
  async getPaymentStats() {
    // 1. Total Transports (Paid vs Volunteer tracking via PricingSnapshot existence? No, all have snapshots)
    // We want stats on FINANCIALS.
    // Total Revenue = Sum of totalRideCost (from PricingSnapshot) for COMPLETED/CHARGED transactions?
    // Actually, "Revenue" usually means Platform Revenue or Total Volume?
    // Let's assume "Total Revenue" = Total Volume processed (Transaction amount).
    // Or Platform Fees?
    // Let's provide a breakdown.

    // Aggregations
    const stats = await this.prisma.client.$transaction(async (tx) => {
      // Transaction Counts by Status
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
        transactions.find((t) => t.status === 'TRANSFERRED')?._count.id || 0; // successfully paid out
      const failedTransactions =
        transactions.find((t) => t.status === 'FAILED')?._count.id || 0;

      // Financials
      // We need to sum up Platform Fees and Driver Payouts.
      // These are in PricingSnapshot. But strictly speaking, we should only count finalized ones.
      // Linked to Transactions that are NOT failed/cancelled.
      // Since aggregating via relation in Prisma is tricky, we might need a raw query or separate aggregation.

      // Sum of amounts in Transactions (this is the Total Charged to Shelters)
      const totalRevenue = transactions
        .filter(
          (t) =>
            t.status === 'CHARGED' ||
            t.status === 'TRANSFERRED' ||
            t.status === 'PROCESSING',
        )
        .reduce((sum, t) => sum + (t._sum.amount || 0), 0);

      // Driver Payouts (We can approximate from Transaction amount - PlatformFees, but platform fee is in snapshot)
      // Let's fetch all COMPLETED transports with transactions
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

      return {
        totalRevenue,
        totalDriverPayouts,
        totalTransactions,
        pendingTransactions,
        completedTransactions,
        failedTransactions,
      };
    });

    return successResponse(stats, 'Payment stats fetched');
  }

  @HandleError('Error holding transaction')
  async holdTransaction(transactionId: string, reason?: string) {
    // Verify exists
    await this.prisma.client.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    const updated = await this.prisma.client.transaction.update({
      where: { id: transactionId },
      data: { status: 'HOLD' },
    });

    if (reason) {
      // Currently no field for reason in Transaction schema.
      // logging it for now.
      // TODO: Add 'cancellationReason' or 'holdReason' to schema if needed.
    }

    return successResponse(updated, 'Transaction put on hold');
  }
}
