import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SPECIES, Status } from '@prisma';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetAnimalDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'Buddy' })
  @IsOptional()
  @IsString()
  search?: string;

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
    example: Status.ADOPTED,
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
