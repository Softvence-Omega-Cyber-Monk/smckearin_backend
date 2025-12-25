import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplexityType } from '@prisma';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { PaymentMode } from '@prisma';

export class AdminPaymentStatsDto {
  totalRevenue: number;
  totalDriverPayouts: number;
  totalTransactions: number;
  pendingTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  driverPaymentsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  platformFeesEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  timeBasedPricingEnabled?: boolean;

  @ApiPropertyOptional({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  @IsOptional()
  paymentMode?: PaymentMode;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  paymentEnabled?: boolean;
}

export class UpdatePricingRuleDto {
  @ApiProperty({ description: 'Rate per mile in dollars', example: 0.65 })
  @IsNumber()
  @Min(0)
  ratePerMile: number;

  @ApiProperty({ description: 'Rate per minute in dollars', example: 0.3 })
  @IsNumber()
  @Min(0)
  ratePerMinute: number;

  @ApiProperty({ description: 'Base fare for the ride', example: 5.0 })
  @IsNumber()
  @Min(0)
  baseFare: number;

  @ApiProperty({ description: 'Platform fee percentage (0-100)', example: 10 })
  @IsNumber()
  @Min(0)
  platformFeePercent: number;

  @ApiProperty({ description: 'Minimum payout to driver', example: 5.0 })
  @IsNumber()
  @Min(0)
  minPayout: number;
}

export class UpdateComplexityFeeDto {
  @ApiProperty({ description: 'Fee amount in dollars', example: 20.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Additional flat fee for multi-animal',
    example: 5.0,
  })
  @IsNumber()
  @Min(0)
  multiAnimalFlatFee: number;
}

export class ComplexityTypeDto {
  @ApiProperty({ enum: ComplexityType, example: ComplexityType.STANDARD })
  @IsEnum(ComplexityType)
  type: ComplexityType;
}

export class HoldTransactionDto {
  @ApiPropertyOptional({
    description: 'Reason for holding the transaction',
    example: 'Suspicious activity',
  })
  @IsOptional()
  reason?: string;
}
