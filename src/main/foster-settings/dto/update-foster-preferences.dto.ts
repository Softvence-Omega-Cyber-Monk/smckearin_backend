import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateFosterPreferencesDto {
  @ApiProperty({ example: ['DOGS'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['DOGS', 'CATS', 'OTHER'], { each: true })
  animalTypes: string[];

  @ApiPropertyOptional({ example: 'ANY' })
  @IsOptional()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE', 'ANY'])
  sizePreference?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxAnimalsAtOnce: number;

  @ApiPropertyOptional({ example: 'Available evenings and weekends' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  availabilityNotes?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  locationAddress?: string;

  @ApiPropertyOptional({ example: 30.2672 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @ApiPropertyOptional({ example: -97.7431 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;

  @ApiPropertyOptional({ example: 'CUSTOM' })
  @IsOptional()
  @IsIn(['SUGGESTED', 'CUSTOM'])
  radiusType?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  customRadiusMiles?: number;
}
