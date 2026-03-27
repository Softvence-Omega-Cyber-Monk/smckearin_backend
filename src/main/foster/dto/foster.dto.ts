import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FosterApproveDto extends ApproveOrRejectDto {}

export class UploadFosterDocumentDto {
  @ApiProperty({ example: 'Foster Agreement' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'agreement' })
  @IsString()
  type: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  document: any;
}

export class FosterDocumentApproveDto extends ApproveOrRejectDto {}
