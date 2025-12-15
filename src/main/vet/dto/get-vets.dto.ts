import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma';
import { IsOptional, IsString } from 'class-validator';

export class GetApprovedVets extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search query (name, phone, license)',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class GetVetsDto extends GetApprovedVets {
  @ApiPropertyOptional({
    description: 'Status',
    example: ApprovalStatus.PENDING,
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsString()
  status?: string;
}
