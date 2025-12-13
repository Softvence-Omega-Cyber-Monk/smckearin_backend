import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma';
import { IsOptional, IsString } from 'class-validator';

export class GetApprovedDrivers extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'John Doe' })
  @IsOptional()
  @IsString()
  search: string;
}

export class GetDriversDto extends GetApprovedDrivers {
  @ApiPropertyOptional({
    description: 'Status',
    example: ApprovalStatus.PENDING,
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsString()
  status?: string;
}
