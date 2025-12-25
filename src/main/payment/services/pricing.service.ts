import { AppError } from '@/core/error/handle-error.app';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
  ) {}

  /**
   * Calculates the estimated price for a transport request.
   */
  async calculateEstimate(params: {
    pickUpLatitude: number;
    pickUpLongitude: number;
    dropOffLatitude: number;
    dropOffLongitude: number;
    animalId: string;
    bondedPairId?: string | null;
  }) {
    const [rule, complexityFees, animal, paymentSettings] =
      await this.prisma.client.$transaction([
        this.prisma.client.pricingRule.findFirst({
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.client.animalComplexityFee.findMany(),
        this.prisma.client.animal.findUnique({
          where: { id: params.animalId },
        }),
        this.prisma.client.paymentSettings.findFirst(),
      ]);

    if (!rule)
      throw new AppError(HttpStatus.NOT_FOUND, 'No pricing rules found');
    if (!animal) throw new AppError(HttpStatus.NOT_FOUND, 'Animal not found');

    // Default settings if missing (should be seeded, but safety first)
    const settings = paymentSettings || {
      timeBasedPricingEnabled: false,
      platformFeesEnabled: false,
    };

    // Get distance/duration
    const { distanceMiles, durationMinutes } =
      await this.googleMaps.getDistanceAndDuration(
        { lat: params.pickUpLatitude, lng: params.pickUpLongitude },
        { lat: params.dropOffLatitude, lng: params.dropOffLongitude },
      );

    // Calculate Costs
    const distanceCost = distanceMiles * rule.ratePerMile;

    // Respect time based pricing flag
    const effectiveRatePerMinute = settings.timeBasedPricingEnabled
      ? rule.ratePerMinute
      : 0;
    const timeCost = durationMinutes * effectiveRatePerMinute;

    // Find complexity fee
    const primaryFee = complexityFees.find(
      (f) => f.type === animal.complexityType,
    ) || { amount: 0, multiAnimalFlatFee: 0 };

    let multiAnimalFee = 0;
    if (params.bondedPairId) {
      // Multi-animal fee is usually flat per additional animal
      multiAnimalFee = primaryFee.multiAnimalFlatFee;
    }

    const animalComplexityFee = primaryFee.amount;

    const subtotal =
      rule.baseFare +
      distanceCost +
      timeCost +
      animalComplexityFee +
      multiAnimalFee;

    // Respect platform fee flag
    const effectivePlatformFeePercent = settings.platformFeesEnabled
      ? rule.platformFeePercent
      : 0;
    const platformFeeAmount = (subtotal * effectivePlatformFeePercent) / 100;

    const totalRideCost = subtotal + platformFeeAmount;
    const driverGrossPayout = subtotal; // Platform fee is taken from the total paid by shelter

    return {
      distanceMiles,
      durationMinutes,
      ratePerMile: rule.ratePerMile,
      ratePerMinute: rule.ratePerMinute,
      distanceCost,
      timeCost,
      animalComplexityFee,
      multiAnimalFee,
      platformFeeAmount,
      driverGrossPayout,
      totalRideCost,
    };
  }

  /**
   * Locks the price for a transport by creating a PricingSnapshot.
   */
  async createSnapshot(transportId: string) {
    const transport = await this.prisma.client.transport.findUnique({
      where: { id: transportId },
      include: { animal: true },
    });

    if (!transport)
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport not found');

    const estimate = await this.calculateEstimate({
      pickUpLatitude: transport.pickUpLatitude,
      pickUpLongitude: transport.pickUpLongitude,
      dropOffLatitude: transport.dropOffLatitude,
      dropOffLongitude: transport.dropOffLongitude,
      animalId: transport.animalId,
      bondedPairId: transport.bondedPairId,
    });

    return this.prisma.client.pricingSnapshot.create({
      data: {
        transportId: transport.id,
        ...estimate,
      },
    });
  }
}
