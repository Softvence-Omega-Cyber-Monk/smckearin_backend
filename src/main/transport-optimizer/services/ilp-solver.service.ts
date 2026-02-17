import { HandleError } from '@/core/error/handle-error.decorator';
import { Injectable, Logger } from '@nestjs/common';

/**
 * ILP Solver Service using a simplified greedy algorithm
 * Note: glpk.js is complex to integrate in NestJS. This implementation uses
 * a greedy algorithm that respects all hard constraints and approximates
 * the optimal solution. For production, consider using a dedicated optimization
 * service or Python backend with PuLP/OR-Tools.
 */
@Injectable()
export class IlpSolverService {
  private readonly logger = new Logger(IlpSolverService.name);

  /**
   * Solve the transport batch optimization problem
   *
   * Objective: Maximize Σ(priority_score_i * x_i) + capacity_relief_bonus - transport_cost
   *
   * Hard Constraints:
   * 1. Vehicle Capacity: Σ(crate_units_i * x_i) ≤ vehicle_capacity
   * 2. Bonded Pairs: x_i = x_j for bonded animals i, j
   * 3. Destination Matching: x_i = 0 if animal doesn't match destination restrictions
   * 4. Intake Limits: Σ(x_i) ≤ destination.open_kennels
   */
  @HandleError('Error solving optimization problem')
  async solve(
    animals: any[],
    vehicleCapacity: number,
    destinationConstraints: any,
  ): Promise<{
    selectedAnimalIds: string[];
    totalScore: number;
    totalCrateUnits: number;
  }> {
    this.logger.log(`Solving optimization for ${animals.length} animals`);

    // Filter animals that match destination constraints
    const eligibleAnimals = animals.filter((animal) =>
      this.matchesDestinationConstraints(animal, destinationConstraints),
    );

    this.logger.log(
      `${eligibleAnimals.length} animals match destination constraints`,
    );

    // Sort animals by priority score (descending)
    const sortedAnimals = [...eligibleAnimals].sort(
      (a, b) => b.priorityScore - a.priorityScore,
    );

    // Greedy selection with constraint checking
    const selected: string[] = [];
    const bondedPairsSelected = new Set<string>();
    let totalCrateUnits = 0;
    let totalScore = 0;

    for (const animal of sortedAnimals) {
      // Skip if already selected as part of a bonded pair
      if (bondedPairsSelected.has(animal.id)) {
        continue;
      }

      // Check if this is a bonded pair
      const isBondedPair = !!animal.bondedWithId;
      let requiredCrateUnits = animal.crateUnits;

      if (isBondedPair) {
        // Find the bonded partner
        const partner = eligibleAnimals.find(
          (a) => a.id === animal.bondedWithId,
        );

        if (!partner) {
          // Partner not eligible, skip this animal
          continue;
        }

        // Both animals must fit
        requiredCrateUnits += partner.crateUnits;
      }

      // Check constraints
      const wouldExceedCapacity =
        totalCrateUnits + requiredCrateUnits > vehicleCapacity;
      const wouldExceedKennels =
        selected.length + (isBondedPair ? 2 : 1) >
        destinationConstraints.openKennels;

      if (wouldExceedCapacity || wouldExceedKennels) {
        continue; // Skip this animal
      }

      // Add to selection
      selected.push(animal.id);
      totalCrateUnits += animal.crateUnits;
      totalScore += animal.priorityScore;

      if (isBondedPair) {
        selected.push(animal.bondedWithId);
        bondedPairsSelected.add(animal.id);
        bondedPairsSelected.add(animal.bondedWithId);

        const partner = eligibleAnimals.find(
          (a) => a.id === animal.bondedWithId,
        );
        if (partner) {
          totalCrateUnits += partner.crateUnits;
          totalScore += partner.priorityScore;
        }
      }
    }

    this.logger.log(
      `Selected ${selected.length} animals with total score ${totalScore} and ${totalCrateUnits} crate units`,
    );

    return {
      selectedAnimalIds: selected,
      totalScore,
      totalCrateUnits,
    };
  }

  /**
   * Check if an animal matches destination constraints
   */
  private matchesDestinationConstraints(
    animal: any,
    constraints: any,
  ): boolean {
    // Species constraint
    if (
      constraints.acceptsSpecies.length > 0 &&
      !constraints.acceptsSpecies.includes(animal.species)
    ) {
      return false;
    }

    // Breed restrictions
    if (
      constraints.restrictedBreeds.length > 0 &&
      constraints.restrictedBreeds.some((breed: string) =>
        animal.breed.toLowerCase().includes(breed.toLowerCase()),
      )
    ) {
      return false;
    }

    // Breed acceptance (if specified)
    if (constraints.acceptsBreeds.length > 0) {
      const breedMatches = constraints.acceptsBreeds.some((breed: string) =>
        animal.breed.toLowerCase().includes(breed.toLowerCase()),
      );
      if (!breedMatches) {
        return false;
      }
    }

    // Size constraint (if specified)
    if (constraints.acceptsSizes.length > 0) {
      const animalSize = this.categorizeSize(animal.weight);
      if (!constraints.acceptsSizes.includes(animalSize)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Categorize animal size based on weight
   */
  private categorizeSize(weight: number): string {
    if (weight < 25) return 'SMALL';
    if (weight < 60) return 'MEDIUM';
    return 'LARGE';
  }
}
