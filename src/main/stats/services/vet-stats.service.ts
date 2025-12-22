import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class VetStatsService {
  private logger = new Logger(VetStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calcPercentageChange(current: number, previous: number): string {
    if (previous === 0) return 'N/A';
    return `${(((current - previous) / previous) * 100).toFixed(1)}%`;
  }

  @HandleError('Error getting vet stats')
  async getVetStats(userId: string) {
    this.logger.log(`Getting vet stats for user ${userId}`);

    // Validate user is a vet
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'VETERINARIAN') {
      throw new AppError(HttpStatus.FORBIDDEN, 'User is not a veterinarian');
    }

    // Fetch vet profile
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Vet profile not found');
    }

    const vetId = vet.id;
    const now = DateTime.now();
    const lastMonth = now.minus({ months: 1 }).toJSDate();

    /**
     * TRANSACTION-BASED QUERIES
     */
    const [
      pendingCertificatesCount,
      pendingCertificatesLastMonth,

      certifiedCount,
      certifiedLastMonth,

      requiringVetVisitCount,

      transportRequestsCount,
      transportRequestsCompletedCount,
      transportRequestsApprovedCount,

      healthCertificatesCount,
      healthCertificatesLastMonth,
    ] = await this.prisma.client.$transaction([
      // 1. PENDING CERTIFICATES (VetClearanceRequest)
      this.prisma.client.vetClearanceRequest.count({
        where: {
          veterinarianId: vetId,
          status: { in: ['PENDING_REVIEW', 'PENDING_EVALUATION'] },
        },
      }),

      // last month pending
      this.prisma.client.vetClearanceRequest.count({
        where: {
          veterinarianId: vetId,
          status: { in: ['PENDING_REVIEW', 'PENDING_EVALUATION'] },
          createdAt: { gte: lastMonth },
        },
      }),

      // 2. CERTIFIED FOR TRANSPORT
      this.prisma.client.vetClearanceRequest.count({
        where: { veterinarianId: vetId, status: 'CERTIFIED' },
      }),

      this.prisma.client.vetClearanceRequest.count({
        where: {
          veterinarianId: vetId,
          status: 'CERTIFIED',
          updatedAt: { gte: lastMonth },
        },
      }),

      // 3. ANIMALS REQUIRING VET VISIT
      this.prisma.client.vetClearanceRequest.count({
        where: { veterinarianId: vetId, status: 'NEEDS_VISIT' },
      }),

      // 4. TRANSPORT REQUESTS (VetClearanceRequest has relation to transports)
      this.prisma.client.vetClearanceRequest.count({
        where: { veterinarianId: vetId },
      }),

      // Completed ones
      this.prisma.client.vetClearanceRequest.count({
        where: { veterinarianId: vetId, status: 'CERTIFIED' },
      }),

      // Approved = Requests where vet already evaluated
      this.prisma.client.vetClearanceRequest.count({
        where: {
          veterinarianId: vetId,
          status: { in: ['CERTIFIED', 'NOT_FIT'] },
        },
      }),

      // 5. HEALTH CERTIFICATES ISSUED (HealthReport)
      this.prisma.client.healthReport.count({
        where: {
          veterinarianId: vetId,
          reportType: 'Health',
        },
      }),

      this.prisma.client.healthReport.count({
        where: {
          veterinarianId: vetId,
          reportType: 'Health',
          createdAt: { gte: lastMonth },
        },
      }),
    ]);

    /**
     * BUILD RESPONSE
     */
    const stats = {
      pendingCertificates: {
        total: pendingCertificatesCount,
        pending: pendingCertificatesCount,
        moreThanLastMonth: this.calcPercentageChange(
          pendingCertificatesCount,
          pendingCertificatesLastMonth,
        ),
        label: 'Pending Certificates',
      },

      certifiedForTransport: {
        total: certifiedCount,
        moreThanLastMonth: this.calcPercentageChange(
          certifiedCount,
          certifiedLastMonth,
        ),
        label: 'Certified For Transport',
      },

      animalRequiringVetVisit: {
        total: requiringVetVisitCount,
        label: 'Animals Requiring Vet Visit',
      },

      transportRequest: {
        total: transportRequestsCount,
        completed: transportRequestsCompletedCount,
        approved: transportRequestsApprovedCount,
        label: 'Transport Requests',
      },

      healthCertificates: {
        total: healthCertificatesCount,
        moreThanLastMonth: this.calcPercentageChange(
          healthCertificatesCount,
          healthCertificatesLastMonth,
        ),
        label: 'Health Certificates Issued',
      },
    };

    return successResponse(stats, 'Vet stats fetched successfully');
  }
}
