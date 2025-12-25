import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class GetTransactionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
