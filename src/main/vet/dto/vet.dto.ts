import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UploadVetDocumentDto {
  @ApiProperty({
    example: 'my-document.pdf',
    description: 'Document name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'PDF',
    description: 'Document type',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Document file',
  })
  document: Express.Multer.File;
}

export class VetDocumentApproveDto {
  @ApiProperty({
    example: true,
    description: 'Approved or rejected',
  })
  @IsBoolean()
  approved: boolean;
}
