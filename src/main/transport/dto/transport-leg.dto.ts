import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportLegStatus } from '@prisma';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTransportLegDto {
  @ApiProperty({
    description: 'Sequence order of the leg',
    example: 1,
  })
  @IsNumber()
  sequenceOrder: number;

  @ApiProperty({
    description: 'Pickup location address',
    example: '123 Pickup St, City, State',
  })
  @IsString()
  pickUpLocation: string;

  @ApiProperty({ example: 40.7128 })
  @Type(() => Number)
  @IsNumber()
  pickUpLatitude: number;

  @ApiProperty({ example: -74.006 })
  @Type(() => Number)
  @IsNumber()
  pickUpLongitude: number;

  @ApiProperty({
    description: 'Drop-off location address',
    example: '456 Dropoff St, City, State',
  })
  @IsString()
  dropOffLocation: string;

  @ApiProperty({ example: 40.7306 })
  @Type(() => Number)
  @IsNumber()
  dropOffLatitude: number;

  @ApiProperty({ example: -73.9352 })
  @Type(() => Number)
  @IsNumber()
  dropOffLongitude: number;

  @ApiPropertyOptional({
    description: 'Assigned driver ID for this leg',
    example: 'uuid-driver-id',
  })
  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class UpdateTransportLegStatusDto {
  @ApiProperty({
    enum: TransportLegStatus,
    description: 'New status for the transport leg',
    example: TransportLegStatus.PICKED_UP,
  })
  @IsEnum(TransportLegStatus)
  status: TransportLegStatus;

  @ApiPropertyOptional({
    description: 'Optional note for the status update',
    example: 'Leg picked up successfully',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignLegDriverDto {
  @ApiProperty({
    description: 'ID of the driver to assign to this leg',
    example: 'uuid-driver-id',
  })
  @IsUUID()
  driverId: string;
}
