import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class TransportLocationUpdateDto {
  @ApiProperty({
    description: 'ID of the transport being tracked',
    example: 'a1b2c3d4-e5f6-7890-ab12-cd34ef567890',
  })
  @IsString()
  @IsNotEmpty()
  transportId: string;

  @ApiProperty({
    description: 'Current latitude of the driver',
    example: 23.8103,
  })
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Current longitude of the driver',
    example: 90.4125,
  })
  @IsNumber()
  longitude: number;
}

export class TransportIdDto {
  @ApiProperty({
    description: 'Unique identifier of the transport',
    example: 'tr_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  transportId: string;
}
