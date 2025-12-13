import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DriverRegisterDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Valid email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Password (min 6 characters)',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Phone number',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    example: '123 Main St, Anytown, USA',
    description: 'Address',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: 'NY',
    description: 'State',
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  // Vehicle info
  @ApiProperty({
    example: 'SUV',
    description: 'Vehicle type',
  })
  @IsString()
  @IsNotEmpty()
  vehicleType: string;

  @ApiProperty({
    example: 'ABC123',
    description: 'License number',
  })
  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @ApiProperty({
    example: 4,
    description: 'Vehicle capacity',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  vehicleCapacity: number;

  @ApiProperty({
    example: 5,
    description: 'Years of experience',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  yearsOfExperience: number;

  @ApiProperty({
    example: 'Some previous experience',
    description: 'Previous experience',
  })
  @IsString()
  @IsOptional()
  previousExperience: string;

  // File uploads
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Driver License Image',
  })
  driverLicense: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Vehicle Registration Document',
  })
  vehicleRegistration: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Transport Certificate Document',
  })
  transportCertificate: Express.Multer.File;
}
