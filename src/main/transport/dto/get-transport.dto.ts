import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
  @IsEnum(TransportDateFilter)
  dateFilter?: TransportDateFilter;
}
