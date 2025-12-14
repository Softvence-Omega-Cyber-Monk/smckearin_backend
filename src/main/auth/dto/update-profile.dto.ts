import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'Optional name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional profile image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}

export class UpdateDriverProfileDto extends UpdateProfileDto {
  @ApiPropertyOptional({
    example: '1234567890',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'California',
    description: 'Optional state of residence',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    example: '123 Main St, Los Angeles',
    description: 'Optional address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'Truck',
    description: 'Optional vehicle type',
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Optional vehicle capacity in tons',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vehicleCapacity?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Optional years of driving experience',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({
    example: 'Previously worked in XYZ company',
    description: 'Optional previous experience',
  })
  @IsOptional()
  @IsString()
  previousExperience?: string;
}

export class UpdateVetProfileDto extends UpdateProfileDto {
  @ApiPropertyOptional({
    example: '1234567890',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'VET-12345',
    description: 'Optional license number',
  })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({
    example: 'Specialist in small animals',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateShelterProfileDto {
  @ApiPropertyOptional({
    example: 'Happy Shelter',
    description: 'Optional name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional shelter logo',
  })
  @IsOptional()
  file?: Express.Multer.File;

  @ApiPropertyOptional({
    example: '123 Shelter St, City',
    description: 'Optional address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: '1234567890',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'A safe haven for animals',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
