import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class OptimizeBatchDto {
  @IsNotEmpty()
  @IsString()
  originShelterId: string;

  @IsNotEmpty()
  @IsString()
  destinationShelterId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  vehicleCapacity: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  estimatedCost?: number;
}

export class OptimizationResultDto {
  batchId: string;
  selectedAnimals: SelectedAnimalDto[];
  totalPriorityScore: number;
  totalCrateUnits: number;
  estimatedCost?: number;
  summary: {
    totalAnimals: number;
    totalBondedPairs: number;
    averagePriority: number;
  };
}

export class SelectedAnimalDto {
  animalId: string;
  name: string;
  priorityScore: number;
  crateUnits: number;
  rationale: string;
  isBondedPair: boolean;
  bondedWithId?: string;
}

export class OptimizationConstraintsDto {
  vehicleCapacity: number;
  destinationOpenKennels: number;
  destinationAcceptsSpecies: string[];
  destinationAcceptsSizes: string[];
  destinationAcceptsBreeds: string[];
  destinationRestrictedBreeds: string[];
}
