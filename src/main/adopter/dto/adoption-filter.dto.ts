import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ShelterAdoptionFilter {
  ALL = 'all',
  AVAILABLE = 'available',
  REQUESTED = 'requested',
  ADOPTED = 'adopted',
}

export class GetShelterAdoptionsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ShelterAdoptionFilter,
    default: ShelterAdoptionFilter.ALL,
  })
  @IsEnum(ShelterAdoptionFilter)
  @IsOptional()
  filter?: ShelterAdoptionFilter;
}

export enum AdopterSpeciesFilter {
  ALL = 'all',
  DOG = 'dog',
  CAT = 'cat',
  OTHERS = 'others',
}

export class GetAvailableAdoptionsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: AdopterSpeciesFilter,
    default: AdopterSpeciesFilter.ALL,
  })
  @IsEnum(AdopterSpeciesFilter)
  @IsOptional()
  species?: AdopterSpeciesFilter;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}

export class SubmitAdoptionRequestDto {
  @ApiProperty({ example: 'adoption-id-uuid' })
  @IsString()
  adoptionId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class GetMyRequestsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
