import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdminStatsService {
  private logger = new Logger(AdminStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error getting admin stats')
  async getAdminStats(userId: string) {
    this.logger.log(`Getting admin stats for user ${userId}`);

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
    const totalDriver = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Driver',
    };
    const totalShelter = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Total Shelter',
    };

    return successResponse(
      {
        activeTrips,
        totalTrips,
        completedTrips,
        totalAnimalRescued,
        totalDriver,
        totalShelter,
      },
      'Admin stats fetched successfully',
    );
  }
}
