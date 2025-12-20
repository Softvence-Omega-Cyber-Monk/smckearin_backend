import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { CreateHealthReportDto } from '../dto/health-report.dto';

@Injectable()
export class HealthReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Could not create health report', 'Health report')
  async createHealthReport(userId: string, dto: CreateHealthReportDto) {
    const vet = await this.prisma.client.veterinarian.findUniqueOrThrow({
      where: { userId },
    });

    if (!vet.status || vet.status !== 'APPROVED') {
      throw new AppError(HttpStatus.FORBIDDEN, 'Vet is not approved');
    }

    let fileInstance: FileInstance | undefined;
    if (dto.report) {
      fileInstance = await this.s3.uploadFile(dto.report);
    }

    let animalId = dto.animalId;

    if (animalId) {
      // Validate existing animal
      await this.prisma.client.animal.findUniqueOrThrow({
        where: { id: animalId },
      });
    } else {
      // New animal creation → validate required fields
      if (!dto.name || !dto.breed || !dto.species || !dto.gender) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Missing required fields for new animal: name, breed, species, gender',
        );
      }

      const newAnimal = await this.prisma.client.animal.create({
        data: {
          name: dto.name,
          breed: dto.breed,
          species: dto.species,
          gender: dto.gender,
        },
      });

      animalId = newAnimal.id;
    }

    const report = await this.prisma.client.healthReport.create({
      data: {
        veterinarianId: vet.id,
        animalId,
        reportType: dto.reportType,
        note: dto.note,
        reportId: fileInstance?.id ?? null,
        reportIdUrl: fileInstance?.url ?? null,
      },
      include: {
        animal: true,
        veterinarian: true,
        report: true,
      },
    });

    return {
      message: 'Health report created successfully',
      data: report,
    };
  }
}
