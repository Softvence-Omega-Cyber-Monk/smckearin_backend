import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SPECIES } from '@prisma';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHealthReportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Report file',
  })
  report: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'Primary animal ID',
    example: 'uuid-animal-id',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({ description: 'Name of the animal', example: 'Buddy' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Breed of the animal',
    example: 'Labrador',
  })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({
    description: 'Species of the animal',
    enum: SPECIES,
    example: SPECIES.DOG,
  })
  @IsOptional()
  @IsEnum(SPECIES)
  species?: SPECIES;

  @ApiPropertyOptional({
    description: 'Gender of the animal',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    description: 'Report type',
    example: 'Vaccination',
  })
  @IsOptional()
  reportType: string;

  @ApiProperty({
    description: 'Report note',
    example: 'Vaccination note',
  })
  @IsOptional()
  note: string;
}

export class UpdateHealthReportDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Report file update',
  })
  @IsOptional()
  report?: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'Report type',
    example: 'Vaccination',
  })
  @IsOptional()
  @IsString()
  reportType?: string;

  @ApiPropertyOptional({
    description: 'Report note',
    example: 'Vaccination was done successfully',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
