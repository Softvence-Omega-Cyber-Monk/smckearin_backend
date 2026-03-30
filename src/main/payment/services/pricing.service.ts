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
    animalIds: string[];
    bondedPairId?: string | null;
    distanceMiles?: number | null;
    durationMinutes?: number | null;
  }) {
    const [rule, complexityFees, animals, paymentSettings] =
      await this.prisma.client.$transaction([
        this.prisma.client.pricingRule.findFirst({
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.client.animalComplexityFee.findMany(),
        this.prisma.client.animal.findMany({
          where: { id: { in: params.animalIds } },
        }),
        this.prisma.client.paymentSettings.findFirst(),
      ]);

    if (!rule)
      throw new AppError(HttpStatus.NOT_FOUND, 'No pricing rules found');
    if (animals.length === 0)
      throw new AppError(HttpStatus.NOT_FOUND, 'No animals found');

    // Default settings if missing (should be seeded, but safety first)
    const settings = paymentSettings || {
      timeBasedPricingEnabled: false,
      platformFeesEnabled: false,
    };

    const routeMetrics: { distanceMiles: number; durationMinutes: number } =
      typeof params.distanceMiles === 'number' &&
      typeof params.durationMinutes === 'number'
        ? {
            distanceMiles: params.distanceMiles,
            durationMinutes: params.durationMinutes,
          }
        : await this.googleMaps.getDistanceAndDuration(
            { lat: params.pickUpLatitude, lng: params.pickUpLongitude },
            { lat: params.dropOffLatitude, lng: params.dropOffLongitude },
          );
    const { distanceMiles, durationMinutes } = routeMetrics;

    // Calculate Costs
    const distanceCost = distanceMiles * rule.ratePerMile;

    // Respect time based pricing flag
    const effectiveRatePerMinute = settings.timeBasedPricingEnabled
      ? rule.ratePerMinute
      : 0;
    const timeCost = durationMinutes * effectiveRatePerMinute;

    // Find complexity fee for each animal
    let animalComplexityFee = 0;
    for (const animal of animals) {
      const primaryFee = complexityFees.find(
        (f) => f.type === animal.complexityType,
      ) || { amount: 0, multiAnimalFlatFee: 0 };
      animalComplexityFee += primaryFee.amount;
    }

    let multiAnimalFee = 0;
    if (params.bondedPairId || animals.length > 1) {
      // Multi-animal fee if it's a bonded pair or just multiple animals
      const primaryFee = complexityFees[0] || { multiAnimalFlatFee: 0 };
      multiAnimalFee = primaryFee.multiAnimalFlatFee * (animals.length - 1);
    }

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
      include: { animals: true },
    });

    if (!transport)
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport not found');

    const estimate = await this.calculateEstimate({
      pickUpLatitude: transport.pickUpLatitude,
      pickUpLongitude: transport.pickUpLongitude,
      dropOffLatitude: transport.dropOffLatitude,
      dropOffLongitude: transport.dropOffLongitude,
      animalIds: transport.animals.map((a: any) => a.id),
      bondedPairId: transport.bondedPairId,
      distanceMiles: transport.manualDistanceMiles,
      durationMinutes: transport.manualDurationMinutes,
    });

    return this.prisma.client.pricingSnapshot.create({
      data: {
        transportId: transport.id,
        ...estimate,
      },
    });
  }
}
