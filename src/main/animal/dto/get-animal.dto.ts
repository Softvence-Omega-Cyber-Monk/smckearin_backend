import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SPECIES, Status } from '@prisma';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GetAnimalDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Global search (name, breed, or sid)',
    example: 'Buddy',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Specific name to filter by',
    example: 'Buddy',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Specific Animal ID (SID) to filter by',
    example: 'A-123',
  })
  @IsOptional()
  @IsString()
  sid?: string;

  @ApiPropertyOptional({
    description: 'Filter by species',
    example: SPECIES.DOG,
    enum: SPECIES,
  })
  @IsOptional()
  @IsEnum(SPECIES)
  species?: SPECIES;

  @ApiPropertyOptional({
    description: 'Filter by gender',
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: Status.AT_SHELTER,
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class GetPendingAnimalDto {
  @ApiPropertyOptional({
    description: 'Global search (name, breed, or sid)',
    example: 'Buddy',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Specific name to filter by',
    example: 'Buddy',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Specific Animal ID (SID) to filter by',
    example: 'A-123',
  })
  @IsOptional()
  @IsString()
  sid?: string;

  @ApiPropertyOptional({ description: 'Max number of results', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
