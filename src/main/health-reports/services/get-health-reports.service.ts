import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { GetTransportDto } from '@/main/transport/dto/get-transport.dto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';

@Injectable()
export class GetHealthReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(dto: GetTransportDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private applySearchFilter(
    where: Prisma.HealthReportWhereInput,
    search?: string,
  ) {
    if (!search) return;

    where.OR = [
      { note: { contains: search, mode: 'insensitive' } },
      { reportType: { contains: search, mode: 'insensitive' } },
      { animal: { name: { contains: search, mode: 'insensitive' } } },
      { animal: { breed: { contains: search, mode: 'insensitive' } } },
      {
        veterinarian: {
          user: { name: { contains: search, mode: 'insensitive' } },
        },
      },
    ];
  }

  private transformHealthReport(report: any) {
    return {
      id: report.id,
      reportType: report.reportType,
      note: report.note,
      status: report.status,
      reportUrl: report.reportIdUrl ?? null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,

      veterinarian: report.veterinarian
        ? {
            id: report.veterinarian.id,
            name: report.veterinarian.user?.name ?? null,
            phone: report.veterinarian.phone ?? null,
            email: report.veterinarian.user?.email ?? null,
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
            imageUrl: report.animal.image?.url ?? null,
          }
        : null,

      file: report.report
        ? {
            id: report.report.id,
            url: report.report.url,
          }
        : null,
    };
  }

  @HandleError('Could not fetch health report', 'Health report')
  async getSingleHealthReport(reportId: string) {
    const report = await this.prisma.client.healthReport.findUnique({
      where: { id: reportId },
      include: {
        veterinarian: { include: { user: true } },
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

    return successResponse(
      this.transformHealthReport(report),
      'Health report fetched successfully',
    );
  }

  @HandleError('Could not fetch health reports', 'Health reports')
  async getVetsHealthReports(userId: string, dto: GetTransportDto) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');
    }

    const { page, limit, skip } = this.getPagination(dto);

    const where: Prisma.HealthReportWhereInput = {
      veterinarianId: vet.id,
    };

    this.applySearchFilter(where, dto.search);

    const [reports, total] = await this.prisma.client.$transaction([
      this.prisma.client.healthReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          veterinarian: { include: { user: true } },
          animal: { include: { image: true, shelter: true } },
          report: true,
        },
      }),
      this.prisma.client.healthReport.count({ where }),
    ]);

    const data = reports.map((r) => this.transformHealthReport(r));

    return successPaginatedResponse(
      data,
      { page, limit, total },
      'Health reports fetched successfully',
    );
  }

  @HandleError('Could not fetch all health reports', 'Health reports')
  async getAllHealthReports(dto: GetTransportDto) {
    const { page, limit, skip } = this.getPagination(dto);

    const where: Prisma.HealthReportWhereInput = {};

    this.applySearchFilter(where, dto.search);

    const [reports, total] = await this.prisma.client.$transaction([
      this.prisma.client.healthReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          veterinarian: { include: { user: true } },
          animal: { include: { image: true, shelter: true } },
          report: true,
        },
      }),
      this.prisma.client.healthReport.count({ where }),
    ]);

    const data = reports.map((r) => this.transformHealthReport(r));

    return successPaginatedResponse(
      data,
      { page, limit, total },
      'All health reports fetched successfully',
    );
  }
}
