import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SPECIES } from '@prisma';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const normalizeArrayValue = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value)
    ? value
    : String(value)
      .split(',')
      .map((item) => item.trim());

  const sanitized = values.filter(Boolean);
  console.log(sanitized);
  return sanitized.length ? sanitized : undefined;
};

export enum FosterAnimalSizeFilter {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  ANY = 'ANY',
}

export enum FosterAnimalAgeRangeFilter {
  ZERO_TO_SIX_MONTHS = '0_6_MONTHS',
  SIX_TO_TWELVE_MONTHS = '6_12_MONTHS',
  ONE_TO_FIVE_YEARS = '1_5_YEARS',
  FIVE_TO_EIGHT_YEARS = '5_8_YEARS',
  NO_PREFERENCE = 'NO_PREFERENCE',
}

export class GetFosterAnimalsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Buddy',
    description: 'Search by animal name or breed',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: SPECIES,
    isArray: true,
    description: 'Filter by one or more animal species',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeArrayValue(value))
  @IsArray()
  @IsEnum(SPECIES, { each: true })
  animalTypes?: SPECIES[];

  @ApiPropertyOptional({
    enum: FosterAnimalSizeFilter,
    isArray: true,
    description: 'Filter by one or more animal sizes',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeArrayValue(value))
  @IsArray()
  @IsEnum(FosterAnimalSizeFilter, { each: true })
  sizePreferences?: FosterAnimalSizeFilter[];

  @ApiPropertyOptional({
    enum: FosterAnimalAgeRangeFilter,
    isArray: true,
    description: 'Filter by age ranges',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeArrayValue(value))
  @IsArray()
  @IsEnum(FosterAnimalAgeRangeFilter, { each: true })
  ageRanges?: FosterAnimalAgeRangeFilter[];

  @ApiPropertyOptional({
    example: 'Austin, TX',
    description: 'Filter by shelter address or location text',
  })
  @IsOptional()
  @IsString()
  locationSearch?: string;

  @ApiPropertyOptional({
    example: 25,
    description: 'Preferred search radius in miles',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(250)
  radiusMiles?: number;
}

export class CreateFosterAnimalInterestDto {
  @ApiPropertyOptional({
    example: '2026-04-01',
    description: 'Preferred arrival date in ISO date format',
  })
  @IsOptional()
  @IsDateString()
  preferredArrivalDate?: string;

  @ApiProperty({
    example: '11:00 am',
    description: 'Time the foster is available starting from',
  })
  @IsString()
  availableFromTime: string;

  @ApiProperty({
    example: '2:00 pm',
    description: 'Time the foster is available until',
  })
  @IsString()
  availableUntilTime: string;
}

export enum FosterRequestViewStatus {
  INTERESTED = 'INTERESTED',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class GetFosterRequestsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: FosterRequestViewStatus,
    description:
      'Filter by request status as shown to foster users, including scheduled, completed, and cancelled',
  })
  @IsOptional()
  @IsEnum(FosterRequestViewStatus)
  status?: FosterRequestViewStatus;
}

export class ReviewFosterInterestDto {
  @ApiProperty({
    example: true,
    description: 'Approve or reject a foster interest request',
  })
  @IsBoolean()
  approved: boolean;
}
