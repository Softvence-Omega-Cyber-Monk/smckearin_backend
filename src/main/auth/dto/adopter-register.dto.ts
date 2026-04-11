import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export enum AdopterAccountType {
  ADOPTER = 'ADOPTER',
}

export class AdopterRegisterDto {
  @ApiProperty({
    enum: AdopterAccountType,
    example: AdopterAccountType.ADOPTER,
    description: 'Account type for adopter registration',
  })
  @IsEnum(AdopterAccountType)
  accountType: AdopterAccountType;

  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'john_doe@gmail.com',
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

  @ApiProperty({ example: 'City', description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'State', description: 'State' })
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

  @ApiProperty({
    example: 'Apartment',
    description: 'Housing type',
  })
  @IsString()
  @IsNotEmpty()
  housingType: string;

  // @ApiPropertyOptional({
  //   enum: ApprovalStatus,
  //   example: ApprovalStatus.PENDING,
  //   description: 'Account status. Defaults to pending.',
  // })
  // @IsOptional()
  // @IsEnum(ApprovalStatus)
  // status?: ApprovalStatus;
}
