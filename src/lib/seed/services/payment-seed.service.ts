import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PaymentSeedService implements OnModuleInit {
  private readonly logger = new Logger(PaymentSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedPaymentSettings();
    await this.seedPricingRules();
    await this.seedAnimalComplexityFees();
  }

  private async seedPaymentSettings(): Promise<void> {
    const settingsCount = await this.prisma.client.paymentSettings.count();

    if (settingsCount === 0) {
      await this.prisma.client.paymentSettings.create({
        data: {
          driverPaymentsEnabled: false,
          platformFeesEnabled: false,
          timeBasedPricingEnabled: false,
          paymentMode: 'VOLUNTEER',
          paymentEnabled: false,
        },
      });
      this.logger.log('[CREATE] Default PaymentSettings seeded');
    }
  }

  private async seedPricingRules(): Promise<void> {
    const rulesCount = await this.prisma.client.pricingRule.count();

    if (rulesCount === 0) {
      await this.prisma.client.pricingRule.create({
        data: {
          ratePerMile: 0.65,
          ratePerMinute: 0.0,
          baseFare: 0.0,
          platformFeePercent: 0.0,
          minPayout: 0.0,
          effectiveDate: new Date(),
          calculationVersion: 1,
        },
      });
      this.logger.log('[CREATE] Initial PricingRule seeded');
    }
  }

  private async seedAnimalComplexityFees(): Promise<void> {
    const fees = [
      { type: 'STANDARD', amount: 0, multiAnimalFlatFee: 0 },
      { type: 'PUPPY_KITTEN', amount: 10, multiAnimalFlatFee: 5 },
      { type: 'MEDICAL', amount: 20, multiAnimalFlatFee: 10 },
      { type: 'SPECIAL_HANDLING', amount: 25, multiAnimalFlatFee: 15 },
    ];

    for (const fee of fees) {
      const exists = await this.prisma.client.animalComplexityFee.findUnique({
        where: { type: fee.type as any },
      });

      if (!exists) {
        await this.prisma.client.animalComplexityFee.create({
          data: {
            type: fee.type as any,
            amount: fee.amount,
            multiAnimalFlatFee: fee.multiAnimalFlatFee,
          },
        });
        this.logger.log(`[CREATE] AnimalComplexityFee seeded for: ${fee.type}`);
      }
    }
  }
}
