import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetTransportChatMessagesDto extends PaginationDto {}

export class SendTransportChatMessageDto {
  @ApiPropertyOptional({ description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: MessageType, description: 'Message type' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Uploaded file id' })
  @IsOptional()
  @IsString()
  fileId?: string;
}

export class MarkTransportChatReadDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Message ids to mark read',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  messageIds?: string[];
}
