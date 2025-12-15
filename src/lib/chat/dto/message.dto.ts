import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDeliveryStatus, MessageType } from '@prisma';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class BaseMessageDto {
  @ApiPropertyOptional({ description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: MessageType, description: 'Type of message' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'File ID if sending a file' })
  @IsOptional()
  @IsString()
  fileId?: string;
}

export class SendMessageDto extends BaseMessageDto {
  @ApiProperty({ description: 'ID of the conversation to send message to' })
  @IsNotEmpty()
  @IsString()
  conversationId: string;
}

export class MarkReadDto {
  @ApiProperty({ description: 'IDs of messages to mark as read' })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];
}

export class DeleteMessageDto {
  @ApiProperty({ description: 'ID of the message to delete' })
  @IsNotEmpty()
  @IsString()
  messageId: string;
}

export class MessageDeliveryStatusDto {
  @ApiProperty({ description: 'ID of the message to update status' })
  @IsNotEmpty()
  @IsString()
  messageId: string;

  @ApiProperty({
    enum: MessageDeliveryStatus,
    description: 'Status of message',
  })
  @IsNotEmpty()
  @IsEnum(MessageDeliveryStatus)
  status: MessageDeliveryStatus;

  @ApiProperty({ description: 'User ID to update status for' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
