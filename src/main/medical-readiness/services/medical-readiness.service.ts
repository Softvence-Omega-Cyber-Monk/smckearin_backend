import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MedicalReadinessDto,
  UpdateMedicalStatusDto,
} from '../dto/medical-readiness.dto';

@Injectable()
export class MedicalReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate if an animal is cleared for transport based on medical criteria
   */
  @HandleError('Error calculating medical readiness')
  async calculateReadiness(animalId: string): Promise<MedicalReadinessDto> {
    const animal = await this.prisma.client.animal.findUnique({
      where: { id: animalId },
    });

    if (!animal) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Animal not found');
    }

    const reasons: string[] = [];
    let cleared = true;

    // Rule 1: Medical hold flag must be false
    if (animal.medicalHoldFlag) {
      cleared = false;
      reasons.push('Animal is on medical hold');
    }

    // Rule 2: Quarantine status must be CLEARED
    if (animal.quarantineStatus !== 'CLEARED') {
      cleared = false;
      reasons.push(
        `Animal is in ${animal.quarantineStatus.toLowerCase()} status`,
      );
    }

    // Rule 3: Vaccinations must be up to date
    if (!animal.vaccinationsUpToDate) {
      cleared = false;
      reasons.push('Vaccinations are not up to date');
    }

    // Rule 4: Rabies vaccination must not be expired (if applicable)
    if (animal.rabiesExpiration) {
      const now = new Date();
      if (animal.rabiesExpiration < now) {
        cleared = false;
        reasons.push('Rabies vaccination has expired');
      }
    }

    if (cleared) {
      reasons.push('All medical requirements met');
    }

    return {
      clearedForTransport: cleared,
      reasons,
      medicalHoldFlag: animal.medicalHoldFlag,
      quarantineStatus: animal.quarantineStatus,
      vaccinationsUpToDate: animal.vaccinationsUpToDate,
      rabiesExpiration: animal.rabiesExpiration!,
      heartwormStatus: animal.heartwormStatus!,
      specialNeedsFlag: animal.specialNeedsFlag,
    };
  }

  /**
   * Update medical status and automatically recalculate readiness
   */
  @HandleError('Error updating medical status')
  async updateMedicalStatus(animalId: string, dto: UpdateMedicalStatusDto) {
    const animal = await this.prisma.client.animal.findUnique({
      where: { id: animalId },
    });

    if (!animal) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Animal not found');
    }

    // Update medical fields
    const updated = await this.prisma.client.animal.update({
      where: { id: animalId },
      data: {
        medicalHoldFlag: dto.medicalHoldFlag ?? animal.medicalHoldFlag,
        quarantineStatus: dto.quarantineStatus ?? animal.quarantineStatus,
        vaccinationsUpToDate:
          dto.vaccinationsUpToDate ?? animal.vaccinationsUpToDate,
        rabiesExpiration: dto.rabiesExpiration
          ? new Date(dto.rabiesExpiration)
          : animal.rabiesExpiration,
        heartwormStatus: dto.heartwormStatus ?? animal.heartwormStatus,
        specialNeedsFlag: dto.specialNeedsFlag ?? animal.specialNeedsFlag,
        medicalNotes: dto.medicalNotes ?? animal.medicalNotes,
      },
    });

    // Recalculate readiness
    const readiness = await this.calculateReadiness(animalId);

    // Update cleared_for_transport field
    await this.prisma.client.animal.update({
      where: { id: animalId },
      data: {
        clearedForTransport: readiness.clearedForTransport,
      },
    });

    return successResponse(
      { animal: updated, readiness },
      'Medical status updated successfully',
    );
  }

  /**
   * Get all animals cleared for transport in a shelter
   */
  @HandleError('Error fetching cleared animals')
  async getClearedAnimals(shelterId: string) {
    const animals = await this.prisma.client.animal.findMany({
      where: {
        shelterId,
        clearedForTransport: true,
        status: 'AT_SHELTER', // Only animals currently at shelter
      },
      include: {
        shelter: true,
        healthReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        priorityScore: 'desc', // Order by priority score
      },
    });

    return successResponse(animals, 'Cleared animals fetched successfully');
  }

  /**
   * Get medical readiness for a specific animal
   */
  @HandleError('Error fetching medical readiness')
  async getReadiness(animalId: string) {
    const readiness = await this.calculateReadiness(animalId);
    return successResponse(readiness, 'Medical readiness fetched successfully');
  }

  /**
   * Bulk recalculate readiness for all animals in a shelter
   */
  @HandleError('Error recalculating readiness')
  async recalculateAllReadiness(shelterId?: string) {
    const where = shelterId ? { shelterId } : {};

    const animals = await this.prisma.client.animal.findMany({
      where,
      select: { id: true },
    });

    let updated = 0;
    for (const animal of animals) {
      const readiness = await this.calculateReadiness(animal.id);
      await this.prisma.client.animal.update({
        where: { id: animal.id },
        data: { clearedForTransport: readiness.clearedForTransport },
      });
      updated++;
    }

    return successResponse(
      { updated },
      `Recalculated readiness for ${updated} animals`,
    );
  }
}
