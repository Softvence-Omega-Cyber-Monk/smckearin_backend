import { FileType, MessageType, Prisma } from '@prisma';
import { ConversationType } from '../dto/conversation.dto';

export interface SingleConversationResponse {
  conversationId: string;
  type: ConversationType;
  participant: ConversationParticipant; // Single participant (the other user/shelter)
  messages: FormattedMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export enum ChatParticipantType {
  VET = 'VET',
  DRIVER = 'DRIVER',
  SHELTER = 'SHELTER',
  USER = 'USER',
}

export interface ConversationParticipant {
  id: string;
  name: string;
  isActive: boolean;
  role: string;
  avatarUrl: string;
  type: ChatParticipantType;
}

export interface ChatFile {
  id: string;
  url: string;
  fileType: FileType;
  mimeType: string;
  size: number;
}

export interface ReadByParticipant {
  id: string;
  name: string;
  type: ChatParticipantType;
}

export interface FormattedMessage {
  id: string;
  content: string;
  type: MessageType;
  sender: MessageSender;
  fileUrl: string | null;
  file: ChatFile | null;
  isMine: boolean;
  isFromShelter: boolean;
  isFromDriver: boolean;
  isFromVet: boolean;
  isRead: boolean;
  readBy: ReadByParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageSender {
  id: string;
  name: string;
  avatarUrl: string;
}

export type ConversationWithRelations = Prisma.PrivateConversationGetPayload<{
  include: {
    initiator: {
      select: {
        id: true;
        name: true;
        role: true;
        profilePictureId: true;
        profilePictureUrl: true;
        shelterAdminOfId: true;
        managerOfId: true;
      };
    };
    receiver: {
      select: {
        id: true;
        name: true;
        role: true;
        profilePictureId: true;
        profilePictureUrl: true;
        shelterAdminOfId: true;
        managerOfId: true;
      };
    };
    shelter: {
      select: {
        id: true;
        name: true;
        logoUrl: true;
        logoId: true;
        shelterAdmins: {
          select: {
            id: true;
          };
        };
        managers: {
          select: {
            id: true;
          };
        };
      };
    };
    messages: {
      orderBy: {
        createdAt: 'asc';
      };
      include: {
        sender: {
          select: {
            id: true;
            name: true;
            role: true;
            profilePictureId: true;
            profilePictureUrl: true;
            shelterAdminOfId: true;
            managerOfId: true;
          };
        };
        file: {
          select: {
            id: true;
            url: true;
            fileType: true;
            mimeType: true;
            size: true;
          };
        };
        statuses: {
          select: {
            userId: true;
            status: true;
            user: {
              select: {
                id: true;
                name: true;
                role: true;
                profilePictureUrl: true;
                shelterAdminOfId: true;
                managerOfId: true;
              };
            };
          };
        };
      };
    };
  };
}>;
