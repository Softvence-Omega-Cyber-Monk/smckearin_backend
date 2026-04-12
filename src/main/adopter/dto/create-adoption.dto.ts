import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAdoptionDto {
  @ApiProperty({ example: ['animal-id-1', 'animal-id-2'], isArray: true })
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  animalIds: string[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  spayNeuterAvailable?: boolean;

  @ApiPropertyOptional({ example: '2026-04-12T10:16:59Z' })
  @IsDateString()
  @IsOptional()
  spayNeuterDate?: string;

  @ApiPropertyOptional({ example: '2026-04-12T10:16:59Z' })
  @IsDateString()
  @IsOptional()
  lastCheckupDate?: string;

  @ApiPropertyOptional({ example: '2026-04-12T10:16:59Z' })
  @IsDateString()
  @IsOptional()
  vaccinationsDate?: string;

  @ApiPropertyOptional({ example: 'Friendly and active' })
  @IsString()
  @IsOptional()
  personality?: string;

  @ApiPropertyOptional({ example: 'Luna is a gentle Persian cat...' })
  @IsString()
  @IsOptional()
  about?: string;

  @ApiPropertyOptional({ example: 'Requires low-impact exercise' })
  @IsString()
  @IsOptional()
  specialNote?: string;
}
