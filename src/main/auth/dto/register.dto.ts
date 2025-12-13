import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum RegisterType {
  SHELTER = 'SHELTER',
  VET = 'VET',
}

export class RegisterDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Valid email address',
  })
  @IsEmail()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'johndeo',
    description: 'Name',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Password (min 6 characters)',
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'SHELTER or VET' })
  @IsNotEmpty()
  @IsEnum(RegisterType)
  type: RegisterType;

  @ApiPropertyOptional({
    example: 'John Doe Shelter',
    description: 'Shelter name',
  })
  @IsOptional()
  @IsString()
  shelterName?: string;
}
