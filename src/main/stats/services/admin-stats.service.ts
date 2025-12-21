import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class AdminStatsService {
  private logger = new Logger(AdminStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calcPercentageChange(current: number, previous: number): string {
    if (previous === 0) return 'N/A';
    return `${(((current - previous) / previous) * 100).toFixed(1)}%`;
  }

  @HandleError('Error getting admin stats')
  async getAdminStats(userId: string) {
    this.logger.log(`Getting admin stats for user ${userId}`);

    const lastMonth = DateTime.now().minus({ months: 1 }).toJSDate();

    // Transport stats
    const [
      totalTripsCount,
      completedTripsCount,
      activeTripsCount,
      lastMonthTripsCount,
    ] = await this.prisma.client.$transaction([
      this.prisma.client.transport.count(),
      this.prisma.client.transport.count({ where: { status: 'COMPLETED' } }),
      this.prisma.client.transport.count({ where: { status: 'IN_TRANSIT' } }),
      this.prisma.client.transport.count({
        where: { createdAt: { gte: lastMonth } },
      }),
    ]);

    // Animals rescued
    const [totalAnimalRescuedCount, lastMonthAnimalRescuedCount] =
      await this.prisma.client.$transaction([
        this.prisma.client.animal.count(),
        this.prisma.client.animal.count({
          where: { createdAt: { gte: lastMonth } },
        }),
      ]);

    // Drivers
    const [totalDriverCount, lastMonthDriverCount] =
      await this.prisma.client.$transaction([
        this.prisma.client.driver.count(),
        this.prisma.client.driver.count({
          where: { createdAt: { gte: lastMonth } },
        }),
      ]);

    // Shelters
    const [totalShelterCount, lastMonthShelterCount] =
      await this.prisma.client.$transaction([
        this.prisma.client.shelter.count(),
        this.prisma.client.shelter.count({
          where: { createdAt: { gte: lastMonth } },
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
        label: 'Total Animal Rescued',
      },
      totalDriver: {
        total: totalDriverCount,
        moreThanLastMonth: this.calcPercentageChange(
          totalDriverCount,
          lastMonthDriverCount,
        ),
        label: 'Total Driver',
      },
      totalShelter: {
        total: totalShelterCount,
        moreThanLastMonth: this.calcPercentageChange(
          totalShelterCount,
          lastMonthShelterCount,
        ),
        label: 'Total Shelter',
      },
    };

    return successResponse(stats, 'Admin stats fetched successfully');
  }
}
