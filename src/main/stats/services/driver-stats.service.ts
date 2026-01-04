import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class DriverStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private calcPercentageChange(current: number, previous: number): string {
    if (previous === 0) return 'N/A';
    return `${(((current - previous) / previous) * 100).toFixed(1)}%`;
  }

  @HandleError('Error getting driver stats')
  async getDriverStats(userId: string) {
    // Verify driver
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.role !== 'DRIVER') {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a driver');
    }

    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a driver');
    }

    const lastMonth = DateTime.now().minus({ months: 1 }).toJSDate();
    const todayStart = DateTime.now().startOf('day').toJSDate();
    const todayEnd = DateTime.now().endOf('day').toJSDate();

    // Use a Prisma transaction to fetch all counts at once
    const [
      todaysTripsCount,
      totalTripsCount,
      completedTripsCount,
      lastMonthTripsCount,
      totalAnimalRescuedCount,
      lastMonthAnimalRescuedCount,
      totalEarningAgg,
      lastMonthEarningAgg,
    ] = await this.prisma.client.$transaction([
      this.prisma.client.transport.count({
        where: {
          driverId: driver.id,
          transPortDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.client.transport.count({ where: { driverId: driver.id } }),
      this.prisma.client.transport.count({
        where: { driverId: driver.id, status: 'COMPLETED' },
      }),
      this.prisma.client.transport.count({
        where: { driverId: driver.id, createdAt: { gte: lastMonth } },
      }),
      this.prisma.client.animal.count({
        where: { transports: { some: { driverId: driver.id } } },
      }),
      this.prisma.client.animal.count({
        where: {
          transports: {
            some: { driverId: driver.id, createdAt: { gte: lastMonth } },
          },
        },
      }),
      // Earnings aggregations
      this.prisma.client.pricingSnapshot.aggregate({
        _sum: { driverGrossPayout: true },
        where: {
          transport: {
            driverId: driver.id,
            status: 'COMPLETED',
          },
        },
      }),
      this.prisma.client.pricingSnapshot.aggregate({
        _sum: { driverGrossPayout: true },
        where: {
          transport: {
            driverId: driver.id,
            status: 'COMPLETED',
            createdAt: { gte: lastMonth },
          },
        },
      }),
    ]);

    const totalEarning = totalEarningAgg._sum.driverGrossPayout || 0;
    const lastMonthEarning = lastMonthEarningAgg._sum.driverGrossPayout || 0;

    const stats = {
      todaysTrips: {
        total: todaysTripsCount,
        label: "Today's Trips",
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
      totalEarning: {
        total: totalEarning,
        moreThanLastMonth: this.calcPercentageChange(
          totalEarning,
          lastMonthEarning,
        ),
        label: 'Total Earning',
      },
    };

    return successResponse(stats, 'Driver stats fetched successfully');
  }
}
