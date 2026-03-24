import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DocumentTypeEnum } from '../enums/document.enum';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentTypeEnum })
  @IsEnum(DocumentTypeEnum)
  documentType: DocumentTypeEnum;
}
