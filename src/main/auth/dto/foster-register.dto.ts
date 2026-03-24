import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum FosterAccountType {
  FOSTER = 'FOSTER',
}

export class FosterRegisterDto {
  @ApiProperty({
    enum: FosterAccountType,
    example: FosterAccountType.FOSTER,
    description: 'Account type for foster registration',
  })
  @IsEnum(FosterAccountType)
  accountType: FosterAccountType;

  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Valid email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Phone number without + sign',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Austin', description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Texas', description: 'State' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    example: '123 Main St, Austin, TX',
    description: 'Address',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Password (min 6 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'DOG', description: 'Animal type preference' })
  @IsString()
  @IsNotEmpty()
  animalType: string;

  @ApiProperty({
    example: 'MEDIUM',
    description: 'Size preference',
  })
  @IsString()
  @IsNotEmpty()
  sizePreference: string;

  @ApiProperty({
    example: 'Adult',
    description: 'Age preference',
  })
  @IsString()
  @IsNotEmpty()
  age: string;

  @ApiProperty({
    example: 'North Austin',
    description: 'Preferred location',
  })
  @IsString()
  @IsNotEmpty()
  preferredLocation: string;

  @ApiProperty({
    example: 25,
    description: 'Preferred mile radius',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preferredMile: number;

  @ApiPropertyOptional({
    enum: ApprovalStatus,
    example: ApprovalStatus.PENDING,
    description: 'Account status. Defaults to pending.',
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}
