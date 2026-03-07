import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PriorityScoreDto {
  formulaVersion: string;
  score: number;
  breakdown: {
    lengthOfStay: number;
    capacityPressure: number;
    riskFactors: number;
    readinessModifier: number;
  };
  details: string[];
}

export class RecalculateScoresDto {
  @IsOptional()
  shelterId?: string;
}

export class GetHighPriorityDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number;

  @IsOptional()
  shelterId?: string;
}
