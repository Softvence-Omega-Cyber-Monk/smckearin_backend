import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MapCsvDto {
  @IsNotEmpty()
  @IsString()
  mappingTemplateId: string;

  @IsNotEmpty()
  @IsString()
  shelterId: string;

  // File will be handled by multer middleware
}

export class CreateMappingTemplateDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  shelterId: string;

  @IsNotEmpty()
  @IsObject()
  fieldMapping: Record<string, string>;

  @IsOptional()
  @IsObject()
  transformations?: Record<string, Record<string, string>>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMappingTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  fieldMapping?: Record<string, string>;

  @IsOptional()
  @IsObject()
  transformations?: Record<string, Record<string, string>>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FeedConfigDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  provider: string;

  @IsNotEmpty()
  @IsString()
  shelterId: string;

  @IsNotEmpty()
  @IsString()
  apiUrl: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @IsOptional()
  @Type(() => Number)
  pollInterval?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
