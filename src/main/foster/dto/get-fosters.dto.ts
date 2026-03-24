import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetApprovedFosters extends PaginationDto {
  @ApiPropertyOptional({
    example: 'john',
    description: 'Search by name, email, phone, city, or state',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class GetFostersDto extends GetApprovedFosters {
  @ApiPropertyOptional({
    example: 'PENDING',
    description: 'Filter by status: PENDING, APPROVED, REJECTED',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
