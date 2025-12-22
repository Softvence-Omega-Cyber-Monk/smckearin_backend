import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportStatus } from '@prisma';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum TransportDateFilter {
  TODAY = 'TODAY',
  THIS_WEEK = 'THIS_WEEK',
  LAST_WEEK = 'LAST_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  ALL = 'ALL',
}

export class GetTransportDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'Buddy' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter transports by date',
    enum: TransportDateFilter,
    example: TransportDateFilter.LAST_WEEK,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(TransportDateFilter)
  dateFilter?: TransportDateFilter;
}

export class GetTransportByLocationDto extends GetTransportDto {
  @ApiProperty({ example: 40.7128 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -74.006 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  radiusKm: number;
}

export class GetAllTransportHistory extends GetTransportDto {
  @ApiPropertyOptional({
    description: 'Filter transports by status',
    enum: TransportStatus,
    example: TransportStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(TransportStatus)
  status?: TransportStatus;
}
