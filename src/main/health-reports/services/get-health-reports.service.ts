import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class GetHealthReportsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Could not fetch health report', 'Health report')
  async getSingleHealthReport(reportId: string) {
    const report = await this.prisma.client.healthReport.findUnique({
      where: { id: reportId },
      include: {
        veterinarian: {
          include: {
            user: true,
          },
        },
        animal: {
          include: {
            image: true,
            shelter: true,
          },
        },
        report: true,
      },
    });

    if (!report) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Health report not found');
    }

    const payload = {
      id: report.id,
      reportType: report.reportType,
      note: report.note,
      status: report.status,
      reportUrl: report.reportIdUrl,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,

      veterinarian: report.veterinarian
        ? {
            id: report.veterinarian.id,
            name: report.veterinarian.user.name,
            phone: report.veterinarian.phone ?? null,
            email: report.veterinarian.user.email ?? null,
          }
        : null,

      animal: report.animal
        ? {
            id: report.animal.id,
            name: report.animal.name,
            breed: report.animal.breed,
            species: report.animal.species,
            gender: report.animal.gender,
            age: report.animal.age,
            weight: report.animal.weight,
            color: report.animal.color ?? null,
            shelter: report.animal.shelter
              ? {
                  id: report.animal.shelter.id,
                  name: report.animal.shelter.name,
                }
              : null,
            imageUrl: report.animal.imageUrl ?? null,
          }
        : null,
    };

    return successResponse(payload, 'Health report fetched successfully');
  }
}
