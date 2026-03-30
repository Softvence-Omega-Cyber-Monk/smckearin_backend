import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class ShelterStatsService {
  private logger = new Logger(ShelterStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calcPercentageChange(current: number, previous: number): string {
    if (previous === 0) return 'N/A';
    return `${(((current - previous) / previous) * 100).toFixed(1)}%`;
  }

  @HandleError('Error getting shelter stats')
  async getShelterStats(userId: string) {
    this.logger.log(`Getting shelter stats for user ${userId}`);

    // Fetch user & verify role
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['SHELTER_ADMIN', 'MANAGER'].includes(user.role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a shelter user');
    }

    // Find shelter they belong to
    const shelterId = user.shelterAdminOfId || user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with any shelter',
      );
    }

    const now = DateTime.now();
    const lastMonth = now.minus({ months: 1 }).toJSDate();

    // Transaction for optimized querying
    const [
      activeTripsCount,
      totalTripsCount,
      completedTripsCount,
      lastMonthTripsCount,
      totalAnimalRescuedCount,
      lastMonthAnimalRescuedCount,
      approvedDriverCount,
      approvedDriverLastMonthCount,
    ] = await this.prisma.client.$transaction([
      // ACTIVE trips for this shelter
      this.prisma.client.transport.count({
        where: {
          shelterId,
          status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
      }),

      // TOTAL trips for this shelter
      this.prisma.client.transport.count({
        where: { shelterId },
      }),

      // COMPLETED trips
      this.prisma.client.transport.count({
        where: { shelterId, status: 'COMPLETED' },
      }),

      // Trips created last month (for comparison)
      this.prisma.client.transport.count({
        where: { shelterId, createdAt: { gte: lastMonth } },
      }),

      // Total rescued animals
      this.prisma.client.animal.count({
        where: { shelterId },
      }),

      // Animal rescued last month
      this.prisma.client.animal.count({
        where: { shelterId, createdAt: { gte: lastMonth } },
      }),

      // APPROVED drivers
      this.prisma.client.user.count({
        where: {
          role: 'DRIVER',
          drivers: {
            status: 'APPROVED',
          },
        },
      }),

      // Approved drivers last month
      this.prisma.client.user.count({
        where: {
          role: 'DRIVER',
          drivers: {
            status: 'APPROVED',
          },
          createdAt: { gte: lastMonth },
        },
      }),
    ]);

    const stats = {
      activeTrips: {
        total: activeTripsCount,
        moreThanLastMonth: this.calcPercentageChange(
          activeTripsCount,
          lastMonthTripsCount,
        ),
        label: 'Active Trips',
      },
      totalTrips: {
        total: totalTripsCount,
        moreThanLastMonth: this.calcPercentageChange(
          totalTripsCount,
          lastMonthTripsCount,
        ),
        label: 'Total Trips',
      },
      completedTrips: {
        total: completedTripsCount,
        moreThanLastMonth: this.calcPercentageChange(
          completedTripsCount,
          lastMonthTripsCount,
        ),
        label: 'Completed Trips',
      },
      totalAnimalRescued: {
        total: totalAnimalRescuedCount,
        moreThanLastMonth: this.calcPercentageChange(
          totalAnimalRescuedCount,
          lastMonthAnimalRescuedCount,
        ),
        label: 'Total Animals Rescued',
      },
      driverAvailable: {
        total: approvedDriverCount,
        moreThanLastMonth: this.calcPercentageChange(
          approvedDriverCount,
          approvedDriverLastMonthCount,
        ),
        label: 'Total Drivers',
      },
    };

    return successResponse(stats, 'Shelter stats fetched successfully');
  }

  @HandleError('Error getting shelter dashboard')
  async getShelterDashboard(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    if (!user || !['SHELTER_ADMIN', 'MANAGER'].includes(user.role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a shelter user');
    }

    const shelterId = user.shelterAdminOfId || user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with any shelter',
      );
    }

    const [
      activeTripsCount,
      pendingTripsCount,
      activeTrips,
      availableAnimalsCount,
      pendingRequestsCount,
      recentlyCompleted,
    ] = await this.prisma.client.$transaction([
      this.prisma.client.transport.count({
        where: {
          shelterId,
          status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
      }),
      this.prisma.client.transport.count({
        where: {
          shelterId,
          status: 'PENDING',
        },
      }),
      this.prisma.client.transport.findMany({
        where: {
          shelterId,
          status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
        include: {
          animals: true,
        },
        orderBy: { transPortDate: 'asc' },
        take: 5,
      }),
      this.prisma.client.animal.count({
        where: {
          shelterId,
          status: 'AT_SHELTER',
          fosterRequests: {
            none: {
              status: {
                in: ['REQUESTED', 'INTERESTED', 'APPROVED', 'SCHEDULED'],
              },
            },
          },
        },
      }),
      this.prisma.client.fosterRequest.count({
        where: {
          shelterId,
          status: 'REQUESTED',
        },
      }),
      this.prisma.client.fosterRequest.findMany({
        where: {
          shelterId,
          status: 'DELIVERED',
        },
        include: {
          animal: true,
          transport: true,
        },
        orderBy: { deliveryTime: 'desc' },
        take: 5,
      }),
    ]);

    return successResponse(
      {
        activeTripsCount,
        pendingTripsCount,
        activeTrips: activeTrips.map((trip, index) => ({
          transportId: trip.id,
          tripId: `Tr-${String(index + 1).padStart(3, '0')}`,
          animalName: trip.animals.map((a: any) => a.name).join(', ') || null,
          animalBreed: trip.animals.map((a: any) => a.breed).join(', ') || null,
          animalPhoto: trip.animals[0]?.imageUrl ?? null,
          status: trip.status.toLowerCase(),
          pickupLocation: trip.pickUpLocation,
          dropoffLocation: trip.dropOffLocation,
          distanceMi: trip.manualDistanceMiles ?? 0,
          etaMinutes: trip.manualDurationMinutes ?? 0,
        })),
        fosterPlacements: {
          availableAnimalsCount,
          pendingRequestsCount,
        },
        recentlyCompleted: recentlyCompleted.map((item, index) => ({
          transportId: item.transportId,
          tripId: `Tr-${String(index + 1).padStart(3, '0')}`,
          animalName: item.animal?.name ?? null,
          animalBreed: item.animal?.breed ?? null,
          animalPhoto: item.animal?.imageUrl ?? null,
          status: 'delivered',
          pickupLocation: item.transport?.pickUpLocation ?? null,
          dropoffLocation: item.transport?.dropOffLocation ?? null,
          estimateTransportDate: item.estimateTransportDate,
        })),
      },
      'Shelter dashboard fetched successfully',
    );
  }
}
