import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender, SPECIES } from '@prisma';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAnimalDto {
  @ApiProperty({ description: 'Name of the animal', example: 'Buddy' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Breed of the animal', example: 'Labrador' })
  @IsString()
  breed: string;

  @ApiProperty({
    description: 'Species of the animal',
    enum: SPECIES,
    example: SPECIES.DOG,
  })
  @IsEnum(SPECIES)
  species: SPECIES;

  @ApiProperty({
    description: 'Gender of the animal',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({
    description: 'Age of the animal',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({
    description: 'Weight of the animal in kg',
    example: 15.5,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Color of the animal', example: 'Brown' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Special needs of the animal',
    example: 'Requires daily medication',
  })
  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @ApiPropertyOptional({
    description: 'Medical notes for the animal',
    example: 'Vaccinated for rabies',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional({
    description: 'Behavioral notes for the animal',
    example: 'Very friendly',
  })
  @IsOptional()
  @IsString()
  behaviorNotes?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional animal image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}

export class UpdateAnimalDto extends PartialType(CreateAnimalDto) {}
