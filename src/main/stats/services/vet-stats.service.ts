import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class VetStatsService {
  private logger = new Logger(VetStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error getting vet stats')
  async getVetStats(userId: string) {
    this.logger.log(`Getting vet stats for user ${userId}`);

    const pendingCertificates = {
      total: 20,
      pending: 10,
      label: 'Pending Certificates',
    };
    const certifiedForTransport = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Certified For Transport',
    };
    const animalRequiringVetVisit = {
      total: 20,
      label: 'Animals Requiring Vet Visit',
    };
    const transportRequest = {
      total: 20,
      completed: 10,
      approved: 5,
      label: 'Transport Requests',
    };
    const healthCertificates = {
      total: 20,
      moreThanLastMonth: '10%',
      label: 'Health Certificates Issues',
    };

    return successResponse(
      {
        pendingCertificates,
        certifiedForTransport,
        animalRequiringVetVisit,
        transportRequest,
        healthCertificates,
      },
      'Driver stats fetched successfully',
    );
  }
}
