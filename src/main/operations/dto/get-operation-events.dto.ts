import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OperationDomain, OperationStatus } from '@prisma';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class GetOperationEventsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OperationDomain })
  @IsOptional()
  @IsEnum(OperationDomain)
  domain?: OperationDomain;

  @ApiPropertyOptional({ enum: OperationStatus })
  @IsOptional()
  @IsEnum(OperationStatus)
  status?: OperationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Only for admin/super admin. Shelter users are auto-scoped.',
  })
  @IsOptional()
  @IsString()
  shelterId?: string;

  @ApiPropertyOptional({ description: 'ISO date range start' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date range end' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
