import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  OptimizationResultDto,
  OptimizeBatchDto,
  SelectedAnimalDto,
} from '../dto/transport-optimizer.dto';
import { IlpSolverService } from './ilp-solver.service';

@Injectable()
export class BatchOptimizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ilpSolver: IlpSolverService,
  ) {}

  @HandleError('Error optimizing transport batch')
  async optimizeBatch(dto: OptimizeBatchDto): Promise<OptimizationResultDto> {
    // Fetch origin and destination shelters
    const [originShelter, destinationShelter] = await Promise.all([
      this.prisma.client.shelter.findUnique({
        where: { id: dto.originShelterId },
      }),
      this.prisma.client.shelter.findUnique({
        where: { id: dto.destinationShelterId },
      }),
    ]);

    if (!originShelter || !destinationShelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    // Fetch all eligible animals from origin shelter
    const animals = await this.prisma.client.animal.findMany({
      where: {
        shelterId: dto.originShelterId,
        status: 'AT_SHELTER',
        clearedForTransport: true, // Only cleared animals
      },
      include: {
        bondedWith: true,
      },
    });

    if (animals.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'No eligible animals available for transport',
      );
    }

    // Build destination constraints
    const destinationConstraints = {
      openKennels: destinationShelter.openKennels,
      acceptsSpecies: destinationShelter.acceptsSpecies,
      acceptsSizes: destinationShelter.acceptsSizes,
      acceptsBreeds: destinationShelter.acceptsBreeds,
      restrictedBreeds: destinationShelter.restrictedBreeds,
    };

    // Run ILP solver
    const solution = await this.ilpSolver.solve(
      animals,
      dto.vehicleCapacity,
      destinationConstraints,
    );

    // Generate explainability for each animal
    const optimizationLog: Record<string, any> = {};
    const selectedAnimalsData: SelectedAnimalDto[] = [];

    for (const animal of animals) {
      const isSelected = solution.selectedAnimalIds.includes(animal.id);
      const rationale = this.generateRationale(
        animal,
        isSelected,
        originShelter,
        destinationShelter,
        solution,
      );

      optimizationLog[animal.id] = {
        selected: isSelected,
        rationale,
        priorityScore: animal.priorityScore,
        crateUnits: animal.crateUnits,
      };

      if (isSelected) {
        selectedAnimalsData.push({
          animalId: animal.id,
          name: animal.name,
          priorityScore: animal.priorityScore,
          crateUnits: animal.crateUnits,
          rationale,
          isBondedPair: !!animal.bondedWithId,
          bondedWithId: animal.bondedWithId!,
        });
      }
    }

    // Count bonded pairs
    const bondedPairCount =
      selectedAnimalsData.filter((a) => a.isBondedPair).length / 2;

    // Create transport batch record
    const batch = await this.prisma.client.transportBatch.create({
      data: {
        name: dto.name || `Batch ${new Date().toISOString().split('T')[0]}`,
        originShelterId: dto.originShelterId,
        destinationShelterId: dto.destinationShelterId,
        vehicleCapacity: dto.vehicleCapacity,
        selectedAnimalIds: solution.selectedAnimalIds,
        totalPriorityScore: solution.totalScore,
        totalCrateUnits: solution.totalCrateUnits,
        estimatedCost: dto.estimatedCost,
        optimizationLog,
        status: 'PENDING',
      },
    });

    return {
      batchId: batch.id,
      selectedAnimals: selectedAnimalsData,
      totalPriorityScore: solution.totalScore,
      totalCrateUnits: solution.totalCrateUnits,
      estimatedCost: dto.estimatedCost,
      summary: {
        totalAnimals: solution.selectedAnimalIds.length,
        totalBondedPairs: bondedPairCount,
        averagePriority:
          solution.selectedAnimalIds.length > 0
            ? solution.totalScore / solution.selectedAnimalIds.length
            : 0,
      },
    };
  }

  /**
   * Generate human-readable rationale for selection/rejection
   */
  private generateRationale(
    animal: any,
    isSelected: boolean,
    originShelter: any,
    destinationShelter: any,
    solution: any,
  ): string {
    if (isSelected) {
      const reasons: string[] = [];

      // Priority score
      if (animal.priorityScore >= 70) {
        reasons.push(`high priority score (${animal.priorityScore})`);
      } else if (animal.priorityScore >= 50) {
        reasons.push(`medium priority score (${animal.priorityScore})`);
      }

      // Length of stay
      if (animal.lengthOfStayDays > 90) {
        reasons.push(`${animal.lengthOfStayDays}+ day stay`);
      } else if (animal.lengthOfStayDays > 30) {
        reasons.push(`${animal.lengthOfStayDays} day stay`);
      }

      // Capacity pressure
      if (originShelter.currentUtilization > 85) {
        reasons.push(
          `high capacity pressure (${originShelter.currentUtilization.toFixed(1)}%)`,
        );
      }

      // Bonded pair
      if (animal.bondedWithId) {
        reasons.push('bonded pair');
      }

      return `Selected due to ${reasons.join(', ')}`;
    } else {
      // Not selected - determine why
      if (!animal.clearedForTransport) {
        return 'Not selected: not medically cleared for transport';
      }

      if (
        destinationShelter.acceptsSpecies.length > 0 &&
        !destinationShelter.acceptsSpecies.includes(animal.species)
      ) {
        return `Not selected: destination does not accept ${animal.species}`;
      }

      if (
        destinationShelter.restrictedBreeds.some((breed: string) =>
          animal.breed.toLowerCase().includes(breed.toLowerCase()),
        )
      ) {
        return `Not selected: breed (${animal.breed}) restricted at destination`;
      }

      if (animal.bondedWithId) {
        const partner = solution.selectedAnimalIds.includes(
          animal.bondedWithId,
        );
        if (!partner) {
          return 'Not selected: bonded partner not eligible';
        }
      }

      return 'Not selected: exceeds vehicle capacity or kennel limits';
    }
  }

  @HandleError('Error fetching batch')
  async getBatch(batchId: string) {
    const batch = await this.prisma.client.transportBatch.findUnique({
      where: { id: batchId },
      include: {
        originShelter: true,
        destinationShelter: true,
      },
    });

    if (!batch) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Batch not found');
    }

    return successResponse(batch, 'Batch fetched successfully');
  }

  @HandleError('Error fetching batches')
  async getBatches(shelterId?: string) {
    const where: any = {};

    if (shelterId) {
      where.OR = [
        { originShelterId: shelterId },
        { destinationShelterId: shelterId },
      ];
    }

    const batches = await this.prisma.client.transportBatch.findMany({
      where,
      include: {
        originShelter: true,
        destinationShelter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(batches, 'Batches fetched successfully');
  }

  @HandleError('Error executing batch')
  async executeBatch(batchId: string) {
    const batch = await this.prisma.client.transportBatch.findUnique({
      where: { id: batchId },
      include: {
        originShelter: true,
        destinationShelter: true,
      },
    });

    if (!batch) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Batch not found');
    }

    if (batch.status === 'EXECUTED') {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Batch has already been executed',
      );
    }

    // Create transport records for each selected animal
    const transports = [];
    for (const animalId of batch.selectedAnimalIds) {
      const animal = await this.prisma.client.animal.findUnique({
        where: { id: animalId },
      });

      if (!animal) continue;

      // Create transport record
      const transport = await this.prisma.client.transport.create({
        data: {
          transportNote: `Optimized batch transport: ${batch.name}`,
          priorityLevel:
            animal.priorityScore >= 70
              ? 'HIGH'
              : animal.priorityScore >= 50
                ? 'MEDIUM'
                : 'LOW',
          pickUpLocation:
            batch.originShelter.address || batch.originShelter.name,
          pickUpLatitude: 0, // TODO: Get from shelter geocoding
          pickUpLongitude: 0,
          dropOffLocation:
            batch.destinationShelter.address || batch.destinationShelter.name,
          dropOffLatitude: 0,
          dropOffLongitude: 0,
          transPortDate: new Date(),
          animalId: animal.id,
          isBondedPair: !!animal.bondedWithId,
          bondedPairId: animal.bondedWithId,
          shelterId: batch.originShelterId,
          status: 'PENDING',
        },
      });

      transports.push(transport);

      // Update animal status
      await this.prisma.client.animal.update({
        where: { id: animalId },
        data: { status: 'IN_TRANSIT' },
      });
    }

    // Mark batch as executed
    await this.prisma.client.transportBatch.update({
      where: { id: batchId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    });

    return successResponse(
      { transports, count: transports.length },
      `Created ${transports.length} transport records`,
    );
  }
}
