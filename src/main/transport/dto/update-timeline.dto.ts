import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportStatus } from '@prisma';

export class UpdateTransportStatusQueryDto {
  @ApiProperty({
    description: 'New status of the transport',
    enum: TransportStatus,
  })
  status: TransportStatus;

  @ApiPropertyOptional({
    description: 'Current latitude of the transport',
    type: Number,
    example: 23.8103,
  })
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Current longitude of the transport',
    type: Number,
    example: 90.4125,
  })
  longitude?: number;
}
