import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ShelterGraphStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error fetching shelter trips overview')
  async getTripsOverview(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, 'User not found');

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId)
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with a shelter',
      );

    const [pending, active, inTransit, completed] =
      await this.prisma.client.$transaction([
        this.prisma.client.transport.count({
          where: { shelterId, status: 'PENDING' },
        }),
        this.prisma.client.transport.count({
          where: { shelterId, status: { in: ['ACCEPTED', 'PICKED_UP'] } },
        }),
        this.prisma.client.transport.count({
          where: { shelterId, status: 'IN_TRANSIT' },
        }),
        this.prisma.client.transport.count({
          where: { shelterId, status: 'COMPLETED' },
        }),
      ]);

    const total = pending + active + inTransit + completed;
    const percentCompleted =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return successResponse(
      { percentCompleted, pending, active, inTransit, completed },
      'Shelter trips overview fetched successfully',
    );
  }

  @HandleError('Error fetching shelter trips stats')
  async getTripsStats(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, 'User not found');

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId)
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with a shelter',
      );

    const [totalTrips, activeTrips, completedTrips, incomingAnimals] =
      await this.prisma.client.$transaction([
        this.prisma.client.transport.count({ where: { shelterId } }),
        this.prisma.client.transport.count({
          where: {
            shelterId,
            status: { in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
          },
        }),
        this.prisma.client.transport.count({
          where: { shelterId, status: 'COMPLETED' },
        }),
        this.prisma.client.animal.count({
          where: { shelterId, status: 'AT_SHELTER' },
        }),
      ]);

    const currentPercentage =
      totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0;
    const pendingPercentage =
      totalTrips > 0 ? Math.round((activeTrips / totalTrips) * 100) : 0;

    return successResponse(
      {
        currentPercentage,
        pendingPercentage,
        totalTrips,
        activeTrips,
        completedTrips,
        incomingAnimals,
      },
      'Shelter trips stats fetched successfully',
    );
  }
}
