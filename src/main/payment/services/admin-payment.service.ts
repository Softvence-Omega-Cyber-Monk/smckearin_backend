import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ComplexityType } from '@prisma';
import {
  UpdateComplexityFeeDto,
  UpdatePaymentSettingsDto,
  UpdatePricingRuleDto,
} from '../dto/admin-payment.dto';

@Injectable()
export class AdminPaymentService {
  constructor(private readonly prisma: PrismaService) {}

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
}
