import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'currentPass123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'newPass123' })
  @IsString()
  @MinLength(8)
  @Matches(/\d/, { message: 'Must include a number' })
  newPassword: string;

  @ApiProperty({ example: 'newPass123' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
