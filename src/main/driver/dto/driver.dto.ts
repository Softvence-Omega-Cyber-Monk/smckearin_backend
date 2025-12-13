import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum DriverDocumentType {
  DRIVER_LICENSE = 'DRIVER_LICENSE',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  TRANSPORT_CERTIFICATE = 'TRANSPORT_CERTIFICATE',
}

export class DriverDocumentDeleteDto {
  @ApiProperty({
    enum: DriverDocumentType,
    example: DriverDocumentType.DRIVER_LICENSE,
    description: 'Driver document type',
  })
  @IsEnum(DriverDocumentType)
  type: DriverDocumentType;
}

export class UploadDocumentDto extends DriverDocumentDeleteDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Dcoument',
  })
  file: Express.Multer.File;
}
