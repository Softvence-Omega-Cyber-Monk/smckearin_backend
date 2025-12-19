import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ShelterStatsService {
  private logger = new Logger(ShelterStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error getting driver stats')
  async getShelterStats(userId: string) {
    this.logger.log(`Getting driver stats for user ${userId}`);

    const activeTrips = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Active Trips',
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
    const driverAvailable = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Driver',
    };

    return successResponse(
      {
        activeTrips,
        totalTrips,
        completedTrips,
        totalAnimalRescued,
        driverAvailable,
      },
      'Shelter stats fetched successfully',
    );
  }
}
