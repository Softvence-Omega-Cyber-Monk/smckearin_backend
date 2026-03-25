import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

export class ApproveOrRejectDto {
  @ApiProperty({
    example: true,
    description: 'Approval status',
  })
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsBoolean()
  approved: boolean;
}

export class ApproveOrRejectTransportDto {
  @ApiProperty({
    example: true,
    description: 'Approval status',
  })
  @IsBoolean()
  approved: boolean;
}

export class ApproveOrRejectWithReasonDto extends ApproveOrRejectDto {
  @ApiProperty({
    example: 'Reason for rejection',
    description: 'Reason for rejection',
  })
  @IsString()
  reason: string;
}
