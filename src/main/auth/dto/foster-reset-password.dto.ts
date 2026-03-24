import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class FosterResetPasswordDto {
  @ApiProperty({ example: 'reset-token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'strongPass123' })
  @IsString()
  @MinLength(8)
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  newPassword: string;
}
