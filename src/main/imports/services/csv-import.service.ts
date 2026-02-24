import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ImportJobStatus,
  ImportRowAction,
  OperationDomain,
  OperationStatus,
  Prisma,
} from '@prisma';
import { createHash, randomUUID } from 'crypto';
import * as Papa from 'papaparse';

@Injectable()
export class CsvImportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error processing CSV file')
  async processCsvFile(
    file: Express.Multer.File,
    mappingTemplateId: string,
    shelterId: string,
    idempotencyKey?: string,
  ) {
    const correlationId = randomUUID();

    // Fetch the mapping template
    const template = await this.prisma.client.importMapping.findUnique({
      where: { id: mappingTemplateId },
    });

    if (!template) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Mapping template not found');
    }

    if (template.shelterId !== shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Mapping template does not belong to this shelter',
      );
    }

    const sourceChecksum = createHash('sha256')
      .update(file.buffer)
      .digest('hex');
    const effectiveIdempotencyKey =
      idempotencyKey?.trim() ||
      `csv:${shelterId}:${mappingTemplateId}:${sourceChecksum}`;

    const existingJob = await this.prisma.client.importJob.findUnique({
      where: { idempotencyKey: effectiveIdempotencyKey },
    });

    if (existingJob?.status === ImportJobStatus.COMPLETED) {
      await this.logImportEvent({
        action: 'CSV_IMPORT',
        status: OperationStatus.DUPLICATE,
        correlationId,
        shelterId,
        importJobId: existingJob.id,
        idempotencyKey: effectiveIdempotencyKey,
        entityType: 'ImportJob',
        entityId: existingJob.id,
        payload: {
          message: 'Duplicate CSV upload ignored',
          checksum: sourceChecksum,
        },
      });

      return successResponse(
        {
          duplicate: true,
          importJobId: existingJob.id,
          status: existingJob.status,
          totals: {
            totalRows: existingJob.totalRows,
            processedRows: existingJob.processedRows,
            created: existingJob.createdCount,
            updated: existingJob.updatedCount,
            skipped: existingJob.skippedCount,
            errors: existingJob.errorCount,
          },
        },
        'Duplicate upload detected. Previous successful import returned.',
      );
    }

    if (existingJob?.status === ImportJobStatus.PROCESSING) {
      throw new AppError(
        HttpStatus.CONFLICT,
        'A matching CSV upload is already in progress',
      );
    }

    const importJob = await this.prisma.client.importJob.create({
      data: {
        shelterId,
        mappingTemplateId,
        sourceType: 'CSV',
        sourceFileName: file.originalname,
        sourceChecksum,
        fileSizeBytes: file.size,
        idempotencyKey: effectiveIdempotencyKey,
        status: ImportJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    await this.logImportEvent({
      action: 'CSV_IMPORT',
      status: OperationStatus.STARTED,
      correlationId,
      shelterId,
      importJobId: importJob.id,
      idempotencyKey: effectiveIdempotencyKey,
      entityType: 'ImportJob',
      entityId: importJob.id,
      payload: {
        fileName: file.originalname,
        fileSizeBytes: file.size,
        checksum: sourceChecksum,
      },
    });

    try {
      // Parse CSV file
      const csvContent = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: any) => header.trim(),
      });

      if (parseResult.errors.length > 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          `CSV parsing errors: ${parseResult.errors.map((e: any) => e.message).join(', ')}`,
        );
      }

      const rows = parseResult.data as Record<string, any>[];
      const fieldMapping = template.fieldMapping as Record<string, string>;
      const transformations =
        (template.transformations as Record<string, Record<string, string>>) ||
        {};

      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      const rowAuditRows: Prisma.ImportRowCreateManyInput[] = [];

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;

        try {
          const mappedData = this.mapRow(row, fieldMapping, transformations);
          const mutation = await this.createOrUpdateAnimal(
            mappedData,
            shelterId,
          );

          if (mutation.action === ImportRowAction.CREATED) {
            results.created++;
          } else {
            results.updated++;
          }

          rowAuditRows.push({
            importJobId: importJob.id,
            rowNumber,
            rawData: row,
            mappedData,
            action: mutation.action,
            entityType: 'Animal',
            entityId: mutation.animal.id,
          });
        } catch (error) {
          results.errors.push(`Row ${rowNumber}: ${error.message}`);
          results.skipped++;
          rowAuditRows.push({
            importJobId: importJob.id,
            rowNumber,
            rawData: row,
            action: ImportRowAction.ERROR,
            errorMessage: error.message,
          });
        }
      }

      if (rowAuditRows.length) {
        await this.prisma.client.importRow.createMany({
          data: rowAuditRows,
        });
      }

      const summary = {
        totalRows: rows.length,
        processedRows: rows.length,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors.length,
      };

      await this.prisma.client.importJob.update({
        where: { id: importJob.id },
        data: {
          status: ImportJobStatus.COMPLETED,
          totalRows: summary.totalRows,
          processedRows: summary.processedRows,
          createdCount: summary.created,
          updatedCount: summary.updated,
          skippedCount: summary.skipped,
          errorCount: summary.errors,
          auditLog: {
            fileName: file.originalname,
            checksum: sourceChecksum,
            parsingErrors: parseResult.errors.map((err) => ({
              type: err.type,
              code: err.code,
              message: err.message,
              row: err.row,
            })),
            rowErrors: results.errors,
          } as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });

      await this.logImportEvent({
        action: 'CSV_IMPORT',
        status: OperationStatus.SUCCESS,
        correlationId,
        shelterId,
        importJobId: importJob.id,
        idempotencyKey: effectiveIdempotencyKey,
        entityType: 'ImportJob',
        entityId: importJob.id,
        payload: summary,
      });

      return successResponse(
        {
          importJobId: importJob.id,
          duplicate: false,
          ...summary,
        },
        'CSV import completed',
      );
    } catch (error) {
      await this.prisma.client.importJob.update({
        where: { id: importJob.id },
        data: {
          status: ImportJobStatus.FAILED,
          finishedAt: new Date(),
          errorCount: 1,
          auditLog: {
            failureReason: error.message,
          },
        },
      });

      await this.logImportEvent({
        action: 'CSV_IMPORT',
        status: OperationStatus.FAILURE,
        correlationId,
        shelterId,
        importJobId: importJob.id,
        idempotencyKey: effectiveIdempotencyKey,
        entityType: 'ImportJob',
        entityId: importJob.id,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  @HandleError('Error fetching import jobs')
  async getImportJobs(shelterId: string, page?: number, limit?: number) {
    const currentPage = page && +page > 0 ? +page : 1;
    const currentLimit = limit && +limit > 0 ? +limit : 20;
    const skip = (currentPage - 1) * currentLimit;

    const [jobs, total] = await this.prisma.client.$transaction([
      this.prisma.client.importJob.findMany({
        where: { shelterId },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.importJob.count({
        where: { shelterId },
      }),
    ]);

    return successPaginatedResponse(
      jobs,
      { page: currentPage, limit: currentLimit, total },
      'Import jobs fetched',
    );
  }

  @HandleError('Error fetching import job details')
  async getImportJobDetails(
    jobId: string,
    shelterId: string,
    page?: number,
    limit?: number,
  ) {
    const currentPage = page && +page > 0 ? +page : 1;
    const currentLimit = limit && +limit > 0 ? +limit : 50;
    const skip = (currentPage - 1) * currentLimit;

    const job = await this.prisma.client.importJob.findFirst({
      where: { id: jobId, shelterId },
    });

    if (!job) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Import job not found');
    }

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.importRow.findMany({
        where: { importJobId: jobId },
        skip,
        take: currentLimit,
        orderBy: { rowNumber: 'asc' },
      }),
      this.prisma.client.importRow.count({
        where: { importJobId: jobId },
      }),
    ]);

    return successResponse({
      job,
      rows,
      metadata: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPage: Math.ceil(total / currentLimit),
      },
    });
  }

  private async logImportEvent(params: {
    action: string;
    status: OperationStatus;
    correlationId: string;
    shelterId: string;
    importJobId?: string;
    idempotencyKey?: string;
    entityType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
    errorMessage?: string;
  }) {
    await this.prisma.client.operationEvent.create({
      data: {
        domain: OperationDomain.IMPORT,
        action: params.action,
        status: params.status,
        correlationId: params.correlationId,
        idempotencyKey: params.idempotencyKey,
        shelterId: params.shelterId,
        importJobId: params.importJobId,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload ? this.toJson(params.payload) : undefined,
        errorMessage: params.errorMessage,
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private mapRow(
    row: Record<string, any>,
    fieldMapping: Record<string, string>,
    transformations: Record<string, Record<string, string>>,
  ): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const [sourceColumn, targetField] of Object.entries(fieldMapping)) {
      let value = row[sourceColumn];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Apply transformations if defined
      if (transformations[sourceColumn]) {
        const transformMap = transformations[sourceColumn];
        value = transformMap[value] || value;
      }

      // Type conversions
      if (
        targetField === 'age' ||
        targetField === 'weight' ||
        targetField === 'lengthOfStayDays'
      ) {
        value = parseFloat(value) || 0;
      } else if (
        targetField === 'intakeDate' ||
        targetField === 'rabiesExpiration'
      ) {
        value = new Date(value);
      } else if (
        targetField === 'medicalHoldFlag' ||
        targetField === 'vaccinationsUpToDate' ||
        targetField === 'specialNeedsFlag' ||
        targetField === 'clearedForTransport'
      ) {
        value = value === 'true' || value === '1' || value === 'yes';
      }

      mapped[targetField] = value;
    }

    return mapped;
  }

  private async createOrUpdateAnimal(
    data: Record<string, any>,
    shelterId: string,
  ): Promise<{
    action: ImportRowAction;
    animal: { id: string };
  }> {
    const externalAnimalId = data.externalAnimalId;

    // Build the animal data
    const animalData: Prisma.AnimalCreateInput = {
      name: data.name || 'Unknown',
      breed: data.breed || 'Unknown',
      species: data.species || 'DOG',
      gender: data.gender || 'MALE',
      age: data.age || 0,
      weight: data.weight || 0,
      color: data.color,
      specialNeeds: data.specialNeeds,
      medicalNotes: data.medicalNotes,
      behaviorNotes: data.behaviorNotes,
      shelter: { connect: { id: shelterId } },

      // External tracking
      externalAnimalId: data.externalAnimalId,
      intakeType: data.intakeType,
      intakeDate: data.intakeDate,

      // Medical fields
      medicalHoldFlag: data.medicalHoldFlag || false,
      quarantineStatus: data.quarantineStatus || 'CLEARED',
      vaccinationsUpToDate: data.vaccinationsUpToDate || false,
      rabiesExpiration: data.rabiesExpiration,
      heartwormStatus: data.heartwormStatus,
      specialNeedsFlag: data.specialNeedsFlag || false,

      // Crate units
      crateUnits: data.crateUnits || 1,
    };

    if (externalAnimalId) {
      // Try to find existing animal by external ID
      const existing = await this.prisma.client.animal.findUnique({
        where: { externalAnimalId },
        select: { id: true },
      });

      if (existing) {
        // Update existing animal
        const updateData: Prisma.AnimalUpdateInput = { ...animalData };
        delete (updateData as any).shelter; // Remove relation for update

        const updated = await this.prisma.client.animal.update({
          where: { id: existing.id },
          data: updateData,
          select: { id: true },
        });

        return {
          action: ImportRowAction.UPDATED,
          animal: updated,
        };
      }
    }

    // Create new animal
    const created = await this.prisma.client.animal.create({
      data: animalData,
      select: { id: true },
    });

    return {
      action: ImportRowAction.CREATED,
      animal: created,
    };
  }

  @HandleError('Error detecting duplicates')
  async detectDuplicates(externalAnimalId: string) {
    return await this.prisma.client.animal.findUnique({
      where: { externalAnimalId },
    });
  }
}
