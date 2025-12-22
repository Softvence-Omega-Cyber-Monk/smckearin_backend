import { PaginationDto } from '@/common/dto/pagination.dto';
import { TransportDateFilter } from '@/main/transport/dto/get-transport.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VetClearanceRequestStatus } from '@prisma';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class GetVetClearanceDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'Buddy' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter clearances by date',
    enum: VetClearanceRequestStatus,
    example: VetClearanceRequestStatus.PENDING_REVIEW,
  })
  @IsOptional()
  @IsEnum(VetClearanceRequestStatus)
  status?: VetClearanceRequestStatus;

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

export enum VetClearanceAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  NEEDS_VISIT = 'NEEDS_VISIT',
  FIT_FOR_TRANSPORT = 'FIT_FOR_TRANSPORT',
}

export class VetClearanceActionDto {
  @ApiProperty({
    description: 'Action',
    enum: VetClearanceAction,
    example: VetClearanceAction.APPROVE,
  })
  @IsEnum(VetClearanceAction)
  action: VetClearanceAction;
}

export class MakeNotFitDto {
  @ApiProperty({ description: 'Reasons for not fit', example: 'Not fit' })
  @IsArray()
  notFitReasons: string[];
}
