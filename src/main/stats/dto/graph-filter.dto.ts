import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export enum GraphFilter {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_15_DAYS = 'LAST_15_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  THIS_WEEK = 'THIS_WEEK',
  THIS_MONTH = 'THIS_MONTH',
}

export class GraphFilterDto {
  @ApiProperty({
    enum: GraphFilter,
    description: 'Filter range for transport analytics',
    example: GraphFilter.LAST_7_DAYS,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(GraphFilter)
  filter?: GraphFilter;
}
