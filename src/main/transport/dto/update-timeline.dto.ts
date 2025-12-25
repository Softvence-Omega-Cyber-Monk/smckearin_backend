import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportStatus } from '@prisma';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export class UpdateTransportStatusQueryDto {
  @ApiProperty({
    description: 'New status of the transport',
    enum: TransportStatus,
  })
  @IsEnum(TransportStatus)
  status: TransportStatus;

  @ApiPropertyOptional({
    description: 'Current latitude of the transport',
    type: Number,
    example: 23.8103,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Current longitude of the transport',
    type: Number,
    example: 90.4125,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
