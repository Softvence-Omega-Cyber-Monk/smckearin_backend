import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma';
import { IsOptional, IsString } from 'class-validator';

export class GetApprovedShelters extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search query (name, address, phone)',
    example: 'Happy Paws',
  })
  @IsOptional()
  @IsString()
  search: string;
}

export class GetSheltersDto extends GetApprovedShelters {
  @ApiPropertyOptional({
    description: 'Status',
    example: ApprovalStatus.PENDING,
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsString()
  status?: string;
}
