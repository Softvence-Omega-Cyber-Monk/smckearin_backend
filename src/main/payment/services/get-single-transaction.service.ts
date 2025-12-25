import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma';

@Injectable()
export class GetSingleTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Couldn't get transaction")
  async getTransaction(transactionId: string, user: JWTPayload): Promise<any> {
    const transaction = await this.prisma.client.transaction.findUnique({
      where: { id: transactionId },
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
    });

    if (!transaction) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Transaction not found');
    }

    const { transport } = transaction;

    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    let isDriverOwner = false;
    if (
      user.role === UserRole.DRIVER &&
      transport.driver?.userId === user.sub
    ) {
      isDriverOwner = true;
    }

    let isShelterOwner = false;
    if (
      user.role === UserRole.SHELTER_ADMIN ||
      user.role === UserRole.MANAGER
    ) {
      const requestingUser = await this.prisma.client.user.findUnique({
        where: { id: user.sub },
        select: { shelterAdminOfId: true, managerOfId: true },
      });

      const userShelterId =
        requestingUser?.shelterAdminOfId ?? requestingUser?.managerOfId;
      if (userShelterId === transport.shelterId) {
        isShelterOwner = true;
      }
    }

    if (!isAdmin && !isDriverOwner && !isShelterOwner) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You do not have access to this transaction',
      );
    }

    const snapshot = transport.pricingSnapshot;

    return {
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      createdAt: transaction.createdAt,
      completedAt: transport.completedAt,

      transportId: transport.id,
      transportDate: transport.transPortDate,
      pickupLocation: transport.pickUpLocation,
      dropOffLocation: transport.dropOffLocation,
      distanceMiles: snapshot?.distanceMiles || 0,
      durationMinutes: snapshot?.durationMinutes || 0,

      driverId: transport.driverId,
      driverName: transport.driver?.user?.name || 'Unknown Driver',

      shelterId: transport.shelterId,
      shelterName: transport.shelter?.name || 'Unknown Shelter',

      animalName: transport.animal?.name || 'Unknown Animal',

      ratePerMile: snapshot?.ratePerMile || 0,
      ratePerMinute: snapshot?.ratePerMinute || 0,
      distanceCost: snapshot?.distanceCost || 0,
      timeCost: snapshot?.timeCost || 0,
      complexityFee:
        (snapshot?.animalComplexityFee || 0) + (snapshot?.multiAnimalFee || 0),
      platformFee: snapshot?.platformFeeAmount || 0,
      driverPayout: snapshot?.driverGrossPayout || 0,
      totalCost: snapshot?.totalRideCost || 0,
    };
  }
}
