import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OperationDomain,
  OperationStatus,
  Prisma,
  PriorityScoreTriggerType,
} from '@prisma';
import { randomUUID } from 'crypto';
import { PriorityScoreDto } from '../dto/priority-scoring.dto';

@Injectable()
export class PriorityScoringService {
  private readonly logger = new Logger(PriorityScoringService.name);
  private readonly formulaVersion = 'v1.0.0';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job that runs daily at 2 AM to recalculate all priority scores
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyScoreRecalculation() {
    this.logger.log('Starting daily priority score recalculation');
    await this.recalculateAllScores(undefined, PriorityScoreTriggerType.CRON);
    this.logger.log('Completed daily priority score recalculation');
  }

  /**
   * Calculate priority score for a single animal
   */
  @HandleError('Error calculating priority score')
  async calculateScore(
    animalId: string,
    triggerType: PriorityScoreTriggerType = PriorityScoreTriggerType.SYSTEM,
  ): Promise<PriorityScoreDto> {
    const correlationId = randomUUID();
    const animal = await this.prisma.client.animal.findUnique({
      where: { id: animalId },
      include: { shelter: true },
    });

    if (!animal) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Animal not found');
    }

    if (!animal.shelter) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal must belong to a shelter',
      );
    }

    await this.logScoringEvent({
      action: 'CALCULATE_SCORE',
      status: OperationStatus.STARTED,
      correlationId,
      animalId,
      shelterId: animal.shelterId ?? undefined,
      payload: {
        triggerType,
        formulaVersion: this.formulaVersion,
      },
    });

    // Update length of stay if intake date is set
    if (animal.intakeDate) {
      const now = new Date();
      const intakeDate = new Date(animal.intakeDate);
      const daysDiff = Math.floor(
        (now.getTime() - intakeDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      await this.prisma.client.animal.update({
        where: { id: animalId },
        data: { lengthOfStayDays: daysDiff },
      });

      animal.lengthOfStayDays = daysDiff;
    }

    const breakdown = {
      lengthOfStay: 0,
      capacityPressure: 0,
      riskFactors: 0,
      readinessModifier: 0,
    };

    const details: string[] = [];

    // 1. Length of Stay (Max 30 points)
    const los = animal.lengthOfStayDays;
    if (los <= 7) {
      breakdown.lengthOfStay = 0;
      details.push(`Length of stay: ${los} days (0 points)`);
    } else if (los <= 30) {
      breakdown.lengthOfStay = 10;
      details.push(`Length of stay: ${los} days (10 points)`);
    } else if (los <= 90) {
      breakdown.lengthOfStay = 20;
      details.push(`Length of stay: ${los} days (20 points)`);
    } else {
      breakdown.lengthOfStay = 30;
      details.push(`Length of stay: ${los} days (30 points - critical)`);
    }

    // 2. Capacity Pressure (25 points if >85% utilization)
    if (animal.shelter.currentUtilization > 85) {
      breakdown.capacityPressure = 25;
      details.push(
        `High capacity pressure: ${animal.shelter.currentUtilization.toFixed(1)}% utilization (25 points)`,
      );
    } else {
      details.push(
        `Normal capacity: ${animal.shelter.currentUtilization.toFixed(1)}% utilization (0 points)`,
      );
    }

    // 3. Risk Factors (Max 25 points)
    const bullyBreeds = [
      'Pit Bull',
      'Rottweiler',
      'Doberman',
      'Mastiff',
      'Staffordshire',
    ];
    const isBullyBreed = bullyBreeds.some((breed) =>
      animal.breed.toLowerCase().includes(breed.toLowerCase()),
    );

    if (isBullyBreed) {
      breakdown.riskFactors += 5;
      details.push(`Bully breed (${animal.breed}) (+5 points)`);
    }

    if (animal.weight > 50) {
      breakdown.riskFactors += 5;
      details.push(`Large dog: ${animal.weight} lbs (+5 points)`);
    }

    if (animal.age > 7) {
      breakdown.riskFactors += 5;
      details.push(`Senior animal: ${animal.age} years (+5 points)`);
    }

    if (
      animal.medicalNotes &&
      (animal.medicalNotes.toLowerCase().includes('urgent') ||
        animal.medicalNotes.toLowerCase().includes('critical'))
    ) {
      breakdown.riskFactors += 10;
      details.push('Medical urgency noted (+10 points)');
    }

    // 4. Readiness Modifier (+10 to -10)
    if (animal.clearedForTransport && animal.vaccinationsUpToDate) {
      breakdown.readinessModifier = 10;
      details.push('Medically cleared and vaccinated (+10 points)');
    } else if (!animal.vaccinationsUpToDate) {
      breakdown.readinessModifier = -5;
      details.push('Vaccinations pending (-5 points)');
    }

    if (animal.quarantineStatus === 'QUARANTINE') {
      breakdown.readinessModifier -= 10;
      details.push('In quarantine (-10 points)');
    }

    // Calculate total score
    const totalScore = Math.min(
      100,
      Math.max(
        0,
        breakdown.lengthOfStay +
          breakdown.capacityPressure +
          breakdown.riskFactors +
          breakdown.readinessModifier,
      ),
    );

    // Save the score
    await this.prisma.client.animal.update({
      where: { id: animalId },
      data: {
        priorityScore: totalScore,
        priorityScoreFormulaVersion: this.formulaVersion,
        lastScoreUpdate: new Date(),
      },
    });

    await this.prisma.client.priorityScoreLog.create({
      data: {
        animalId,
        shelterId: animal.shelterId ?? null,
        formulaVersion: this.formulaVersion,
        score: totalScore,
        breakdown,
        details,
        inputSnapshot: {
          intakeDate: animal.intakeDate,
          lengthOfStayDays: animal.lengthOfStayDays,
          shelterCurrentUtilization: animal.shelter.currentUtilization,
          breed: animal.breed,
          weight: animal.weight,
          age: animal.age,
          medicalNotes: animal.medicalNotes,
          clearedForTransport: animal.clearedForTransport,
          vaccinationsUpToDate: animal.vaccinationsUpToDate,
          quarantineStatus: animal.quarantineStatus,
        },
        triggerType,
      },
    });

    await this.logScoringEvent({
      action: 'CALCULATE_SCORE',
      status: OperationStatus.SUCCESS,
      correlationId,
      animalId,
      shelterId: animal.shelterId ?? undefined,
      payload: {
        triggerType,
        formulaVersion: this.formulaVersion,
        score: totalScore,
        breakdown,
      },
    });

    return {
      formulaVersion: this.formulaVersion,
      score: totalScore,
      breakdown,
      details,
    };
  }

  /**
   * Recalculate scores for all animals (or all in a shelter)
   */
  @HandleError('Error recalculating scores')
  async recalculateAllScores(
    shelterId?: string,
    triggerType: PriorityScoreTriggerType = PriorityScoreTriggerType.MANUAL,
  ) {
    const where = shelterId ? { shelterId } : {};
    const correlationId = randomUUID();

    await this.logScoringEvent({
      action: 'RECALCULATE_SCORES',
      status: OperationStatus.STARTED,
      correlationId,
      shelterId,
      payload: {
        triggerType,
        formulaVersion: this.formulaVersion,
      },
    });

    const animals = await this.prisma.client.animal.findMany({
      where,
      select: { id: true },
    });

    let updated = 0;
    for (const animal of animals) {
      try {
        await this.calculateScore(animal.id, triggerType);
        updated++;
      } catch (error) {
        this.logger.error(
          `Failed to calculate score for animal ${animal.id}: ${error.message}`,
        );
      }
    }

    await this.logScoringEvent({
      action: 'RECALCULATE_SCORES',
      status: OperationStatus.SUCCESS,
      correlationId,
      shelterId,
      payload: {
        triggerType,
        formulaVersion: this.formulaVersion,
        totalAnimals: animals.length,
        updated,
      },
    });

    return successResponse(
      { updated },
      `Recalculated priority scores for ${updated} animals`,
    );
  }

  /**
   * Get priority score for a specific animal
   */
  @HandleError('Error fetching priority score')
  async getScore(animalId: string) {
    const score = await this.calculateScore(
      animalId,
      PriorityScoreTriggerType.MANUAL,
    );
    return successResponse(score, 'Priority score calculated successfully');
  }

  /**
   * Get high priority animals above a threshold
   */
  @HandleError('Error fetching high priority animals')
  async getHighPriorityAnimals(threshold: number = 50, shelterId?: string) {
    const where: any = {
      priorityScore: { gte: threshold },
      status: 'AT_SHELTER',
    };

    if (shelterId) {
      where.shelterId = shelterId;
    }

    const animals = await this.prisma.client.animal.findMany({
      where,
      include: {
        shelter: true,
        healthReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        priorityScore: 'desc',
      },
    });

    return successResponse(
      animals,
      `Found ${animals.length} high priority animals`,
    );
  }

  private async logScoringEvent(params: {
    action: string;
    status: OperationStatus;
    correlationId: string;
    animalId?: string;
    shelterId?: string;
    payload?: Record<string, unknown>;
    errorMessage?: string;
  }) {
    await this.prisma.client.operationEvent.create({
      data: {
        domain: OperationDomain.PRIORITY_SCORING,
        action: params.action,
        status: params.status,
        correlationId: params.correlationId,
        animalId: params.animalId,
        shelterId: params.shelterId,
        entityType: params.animalId ? 'Animal' : undefined,
        entityId: params.animalId,
        payload: params.payload ? this.toJson(params.payload) : undefined,
        errorMessage: params.errorMessage,
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
