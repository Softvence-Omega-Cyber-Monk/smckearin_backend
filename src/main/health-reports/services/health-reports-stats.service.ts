import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus } from '@prisma';

@Injectable()
export class HealthReportStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch health report stats')
  async getVetsHealthReportStats(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet) {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a veterinarian');
    }

    const [totalCount, approvedCount, pendingCount, rejectedCount] =
      await Promise.all([
        this.prisma.client.healthReport.count({
          where: { veterinarianId: vet.id },
        }),
        this.prisma.client.healthReport.count({
          where: { veterinarianId: vet.id, status: ApprovalStatus.APPROVED },
        }),
        this.prisma.client.healthReport.count({
          where: { veterinarianId: vet.id, status: ApprovalStatus.PENDING },
        }),
        this.prisma.client.healthReport.count({
          where: { veterinarianId: vet.id, status: ApprovalStatus.REJECTED },
        }),
      ]);

    return successResponse(
      {
        totalCount,
        approvedCount,
        pendingCount,
        rejectedCount,
      },
      'Health report stats fetched successfully',
    );
  }
}
