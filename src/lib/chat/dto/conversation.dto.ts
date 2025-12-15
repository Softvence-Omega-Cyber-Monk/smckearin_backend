import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ConversationType {
  VET = 'VET',
  DRIVER = 'DRIVER',
  SHELTER = 'SHELTER',
}

/** ---------------- Load multiple conversations (with pagination + search) ---------------- */
export class LoadConversationsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search query (e.g., name or message content)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Type of conversations to load' })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;
}

export class InitOrLoadSingleConversationDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Type of conversation' })
  @IsEnum(ConversationType)
  type: ConversationType;
}
