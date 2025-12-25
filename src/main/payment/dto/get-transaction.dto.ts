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

export class DetailedTransactionDto {
  id: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  createdAt: Date;
  completedAt?: Date | null;

  transportId: string;
  transportDate: Date;
  pickupLocation: string;
  dropOffLocation: string;
  distanceMiles: number;
  durationMinutes: number;

  driverId?: string | null;
  driverName?: string | null;

  shelterId?: string | null;
  shelterName?: string | null;

  animalName: string | null;

  // Financial Breakdown
  ratePerMile: number;
  ratePerMinute: number;
  distanceCost: number;
  timeCost: number;
  complexityFee: number;
  platformFee: number;
  driverPayout: number;
  totalCost: number;
}
