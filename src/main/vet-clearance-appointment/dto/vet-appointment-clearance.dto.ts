import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VetClearanceRequestStatus } from '@prisma';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
