import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DriverStatsService {
  private logger = new Logger(DriverStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error getting driver stats')
  async getDriverStats(userId: string) {
    this.logger.log(`Getting driver stats for user ${userId}`);

    const todaysTrips = {
      total: 20,
      label: 'Today Trips',
    };
    const totalTrips = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Trips',
    };
    const completedTrips = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Completed Trips',
    };
    const totalAnimalRescued = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Animal Rescued',
    };
    const totalEarning = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Earning',
    };

    return successResponse(
      {
        todaysTrips,
        totalTrips,
        completedTrips,
        totalAnimalRescued,
        totalEarning,
      },
      'Driver stats fetched successfully',
    );
  }
}
