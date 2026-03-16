import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RequestTransportCancellationDto {
  @ApiProperty({
    example: 'Vehicle issue, unable to continue the trip safely.',
    description: 'Reason provided by the driver for requesting cancellation',
  })
  @IsString()
  reason: string;
}

export class ReviewTransportCancellationDto {
  @ApiProperty({
    example: true,
    description: 'Whether the shelter approves the driver cancellation request',
  })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    example: 'Please wait 15 minutes, replacement support is on the way.',
    description:
      'Optional note from the shelter while approving or rejecting the cancellation request',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
