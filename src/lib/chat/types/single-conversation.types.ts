import { FileInstance, MessageType } from '@prisma';
import { ConversationType } from '../dto/conversation.dto';

export interface SingleConversationResponse {
  conversationId: string;
  type: ConversationType;
  participant: ConversationParticipant; // Single participant (the other user/shelter)
  messages: FormattedMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  isActive: boolean;
  role: string;
  avatarUrl: string;
  type: 'VET' | 'DRIVER' | 'SHELTER' | 'USER';
}

export interface FormattedMessage {
  id: string;
  content: string;
  type: MessageType;
  sender: MessageSender;
  fileUrl: string | null;
  file: FileInstance | null;
  isMine: boolean;
  isFromShelter: boolean;
  isFromDriver: boolean;
  isFromVet: boolean;
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageSender {
  id: string;
  name: string;
  avatarUrl: string;
}
