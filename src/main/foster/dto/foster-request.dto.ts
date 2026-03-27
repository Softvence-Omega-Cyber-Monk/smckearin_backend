import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class GetShelterFosterRequestsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'approved',
    description:
      'Filter foster requests by status. Also accepts completed as an alias for delivered.',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'Bella',
    description: 'Search by animal name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateShelterFosterRequestDto {
  @ApiProperty({
    example: '43cefbf8-b6ef-4a16-a1bb-91a7bc9259f5',
    description: 'Animal id for the foster request',
  })
  @IsUUID()
  animalId: string;

  @ApiPropertyOptional({
    example: '2026-04-02',
    description: 'Estimated transport date',
  })
  @IsDateString()
  estimateTransportDate: string;

  @ApiProperty({
    example: '08:45',
    description: 'Estimated transport start time in HH:mm format',
  })
  @IsString()
  estimateTransportTimeStart: string;

  @ApiProperty({
    example: '16:00',
    description: 'Estimated transport end time in HH:mm format',
  })
  @IsString()
  estimateTransportTimeEnd: string;

  @ApiProperty({
    example: true,
    description: 'Whether spay or neuter information is available',
  })
  @IsBoolean()
  spayNeuterAvailable: boolean;

  @ApiPropertyOptional({
    example: '2026-03-20',
    description: 'Spay or neuter date',
  })
  @IsOptional()
  @IsDateString()
  spayNeuterDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-27',
    description: 'Next spay or neuter date',
  })
  @IsOptional()
  @IsDateString()
  spayNeuterNextDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'Last checkup date',
  })
  @IsOptional()
  @IsDateString()
  lastCheckupDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-18',
    description: 'Vaccination date',
  })
  @IsOptional()
  @IsDateString()
  vaccinationsDate?: string;

  @ApiProperty({
    example: 'Calm, cuddly, and crate-trained',
    description: 'Shelter notes about pet personality',
  })
  @IsString()
  petPersonality: string;

  @ApiProperty({
    example: 'Needs a quiet handoff and soft blanket',
    description: 'Special note from shelter for the foster handoff',
  })
  @IsString()
  specialNote: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['43cefbf8-b6ef-4a16-a1bb-91a7bc9259f5'],
    description: 'Optional additional animals to create requests for',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  additionalAnimalIds?: string[];
}

export class UpdateShelterFosterRequestDto extends PartialType(
  CreateShelterFosterRequestDto,
) {}

export class CancelShelterFosterRequestDto {
  @ApiPropertyOptional({
    example: 'Transport no longer needed',
    description: 'Why the foster request is being cancelled',
  })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

class FosterTransportMilestoneDto {
  @ApiProperty({ example: 'Pickup' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2026-04-03T10:30:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 12.5 })
  @Type(() => Number)
  @IsNumber()
  distanceMi: number;
}

export class CreateFosterTransportDto {
  @ApiProperty({
    example: '0f6f5a2c-a4d1-4f04-bb43-14aa7d0d5d72',
    description: 'Driver id for the scheduled foster delivery',
  })
  @IsUUID()
  driverId: string;

  @ApiProperty({
    example: '100 Shelter Lane, Austin, TX',
    description: 'Pickup address',
  })
  @IsString()
  pickupLocation: string;

  @ApiProperty({
    example: '200 Foster Road, Round Rock, TX',
    description: 'Dropoff address',
  })
  @IsString()
  dropoffLocation: string;

  @ApiProperty({
    example: '2026-04-03T10:00:00.000Z',
    description: 'Transport date and time',
  })
  @IsDateString()
  transportDate: string;

  @ApiProperty({
    example: 'Blue Toyota RAV4',
    description: 'Vehicle name shown to the shelter and foster',
  })
  @IsString()
  vehicleName: string;

  @ApiPropertyOptional({
    type: [FosterTransportMilestoneDto],
    description: 'Optional route milestones from the frontend',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FosterTransportMilestoneDto)
  routeMilestones?: FosterTransportMilestoneDto[];

  @ApiPropertyOptional({
    example: 'Foster handoff scheduled from shelter foster request',
    description: 'Optional transport note',
  })
  @IsOptional()
  @IsString()
  transportNote?: string;
}
