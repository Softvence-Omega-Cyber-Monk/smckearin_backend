import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GetAdoptionChatMessagesDto extends PaginationDto {}

export class SendAdoptionChatMessageDto {
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

  @ApiProperty({ description: 'Adoption ID to associate with the chat' })
  @IsUUID()
  @IsNotEmpty()
  adoptionId: string;
}

export class MarkAdoptionChatReadDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Message ids to mark read',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  messageIds?: string[];
}
