import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class VetGraphStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error fetching vet certification overview')
  async getCertificationOverview(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const vet = await this.prisma.client.veterinarian.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!vet) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a veterinarian');
    }

    const vetId = vet.id;

    const [totalRequests, inProgress, pending, active, completed] =
      await this.prisma.client.$transaction([
        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
          },
        }),

        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
            status: 'PENDING_REVIEW', // in progress
          },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
            status: 'PENDING_EVALUATION', // pending
          },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
            status: 'NEEDS_VISIT', // active
          },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
            status: { in: ['CERTIFIED', 'NOT_FIT'] }, // completed
          },
        }),
      ]);

    const totalPercentage =
      totalRequests > 0 ? Math.round((completed / totalRequests) * 100) : 0;

    return successResponse(
      {
        total: totalRequests,
        totalPercentage,
        inProgress,
        pending,
        active,
        completed,
      },
      'Certification overview fetched successfully',
    );
  }

  @HandleError('Error fetching vet certification stats')
  async getCertificationStats(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId: user.id },
    });

    if (!vet) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a veterinarian');
    }

    const vetId = vet.id;

    // Get counts in a transaction
    const [totalRequests, completed, pending, inProgress, active] =
      await this.prisma.client.$transaction([
        this.prisma.client.vetClearanceRequest.count({
          where: { veterinarianId: vetId },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: {
            veterinarianId: vetId,
            status: { in: ['CERTIFIED', 'NOT_FIT'] },
          },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: { veterinarianId: vetId, status: 'PENDING_EVALUATION' },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: { veterinarianId: vetId, status: 'PENDING_REVIEW' },
        }),
        this.prisma.client.vetClearanceRequest.count({
          where: { veterinarianId: vetId, status: 'NEEDS_VISIT' },
        }),
      ]);

    const currentCertificationStatus =
      totalRequests > 0 ? Math.round((completed / totalRequests) * 100) : 0;
    const pendingCertificationStatus =
      totalRequests > 0
        ? Math.round(((pending + inProgress + active) / totalRequests) * 100)
        : 0;

    return successResponse(
      {
        currentCertificationStatus, // percent completed
        pendingCertificationStatus, // percent pending/in progress/active
        totalCertificationRequests: totalRequests, // total assigned to this vet
        incomingAnimalsForCertification: pending + inProgress + active, // numeric count
        completed, // numeric count
      },
      'Vet certification stats fetched successfully',
    );
  }
}
