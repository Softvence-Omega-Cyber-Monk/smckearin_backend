import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriorityLevel, RequiredVetClearanceType } from '@prisma';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateTransportDto {
  @ApiProperty({
    description: 'Additional notes for the transport',
    example: 'Handle with care, nervous animal',
  })
  @IsString()
  transportNote: string;

  @ApiProperty({
    enum: PriorityLevel,
    example: PriorityLevel.MEDIUM,
  })
  @IsEnum(PriorityLevel)
  priorityLevel: PriorityLevel;

  @ApiProperty({
    example: '123 Main Street, NYC',
  })
  @IsString()
  pickUpLocation: string;

  @ApiProperty({ example: 40.7128 })
  @Type(() => Number)
  @IsNumber()
  pickUpLatitude: number;

  @ApiProperty({ example: -74.006 })
  @Type(() => Number)
  @IsNumber()
  pickUpLongitude: number;

  @ApiProperty({
    example: '456 Shelter Road, NYC',
  })
  @IsString()
  dropOffLocation: string;

  @ApiProperty({ example: 40.73061 })
  @Type(() => Number)
  @IsNumber()
  dropOffLatitude: number;

  @ApiProperty({ example: -73.935242 })
  @Type(() => Number)
  @IsNumber()
  dropOffLongitude: number;

  @ApiPropertyOptional({
    description:
      'Optional manual route distance in miles. If omitted, distance is calculated automatically.',
    example: 12.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  distanceMiles?: number;

  @ApiPropertyOptional({
    description:
      'Optional manual ETA in minutes. If omitted, ETA is calculated automatically.',
    example: 35,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  etaMinutes?: number;

  @ApiProperty({
    description: 'Transport date (ISO format)',
    example: '2025-12-20T10:30:00.000Z',
  })
  @IsISO8601()
  transPortDate: string;

  @ApiProperty({
    description: 'Primary animal ID',
    example: 'uuid-animal-id',
  })
  @IsUUID()
  animalId: string;

  @ApiPropertyOptional({
    description: 'Whether the animal is part of a bonded pair',
    example: false,
  })
  @IsBoolean()
  isBondedPair: boolean;

  @ApiPropertyOptional({
    description: 'Bonded pair animal ID (required if isBondedPair is true)',
    example: 'uuid-bonded-animal-id',
  })
  @IsOptional()
  @IsUUID()
  bondedPairId?: string;

  @ApiPropertyOptional({
    description: "Assigned veterinarian ID, or 'anyone' for auto-selection",
    example: 'uuid-vet-id',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf(
    (_, value) =>
      value !== undefined &&
      value !== null &&
      String(value).toLowerCase() !== 'anyone',
  )
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional({
    description:
      "Assigned driver ID. Omit it or send 'anyone' for auto-selection",
    example: 'uuid-driver-id',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf(
    (_, value) =>
      value !== undefined &&
      value !== null &&
      String(value).toLowerCase() !== 'anyone',
  )
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({
    enum: RequiredVetClearanceType,
    description: 'Required vet clearance type',
    example: RequiredVetClearanceType.No,
  })
  @IsOptional()
  @IsEnum(RequiredVetClearanceType)
  vetClearanceType?: RequiredVetClearanceType;
}
