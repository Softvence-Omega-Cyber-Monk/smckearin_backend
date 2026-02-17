import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import * as Papa from 'papaparse';

@Injectable()
export class CsvImportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Error processing CSV file')
  async processCsvFile(
    file: Express.Multer.File,
    mappingTemplateId: string,
    shelterId: string,
  ) {
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

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const mappedData = this.mapRow(row, fieldMapping, transformations);
        await this.createOrUpdateAnimal(mappedData, shelterId);

        if (mappedData.externalAnimalId) {
          const existing = await this.prisma.client.animal.findUnique({
            where: { externalAnimalId: mappedData.externalAnimalId },
          });
          if (existing) {
            results.updated++;
          } else {
            results.created++;
          }
        } else {
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error.message}`);
        results.skipped++;
      }
    }

    return {
      success: true,
      message: 'CSV import completed',
      data: results,
    };
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
  ) {
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
      });

      if (existing) {
        // Update existing animal
        const updateData: Prisma.AnimalUpdateInput = { ...animalData };
        delete (updateData as any).shelter; // Remove relation for update

        return await this.prisma.client.animal.update({
          where: { id: existing.id },
          data: updateData,
        });
      }
    }

    // Create new animal
    return await this.prisma.client.animal.create({
      data: animalData,
    });
  }

  @HandleError('Error detecting duplicates')
  async detectDuplicates(externalAnimalId: string) {
    return await this.prisma.client.animal.findUnique({
      where: { externalAnimalId },
    });
  }
}
