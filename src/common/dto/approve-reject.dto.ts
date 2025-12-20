import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

export class ApproveOrRejectDto {
  @ApiProperty({
    example: 'true',
    description: 'Approval status',
  })
  @Transform(({ value }) => value === 'true')
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
