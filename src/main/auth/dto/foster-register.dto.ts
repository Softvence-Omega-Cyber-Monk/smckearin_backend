import { UserEnum } from '@/common/enum/user.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class FosterRegisterDto {
  @ApiProperty({
    enum: [UserEnum.FOSTER],
    default: UserEnum.FOSTER,
  })
  @IsEnum(UserEnum)
  accountType: UserEnum.FOSTER = UserEnum.FOSTER;

  @ApiProperty({ example: 'Jane Foster' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Texas' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'strongPass123' })
  @MinLength(8)
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password: string;

  @ApiProperty({ example: 'strongPass123' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
