import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty({
    example: 'fcm-token-123',
    description: 'FCM device token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'android',
    description: 'Device type',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceType?: string;
}
