export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  lastMessage: string;
  lastMessageAt: Date | null;
  isActive: boolean;
  conversationId: string | null;
  avatarUrl: string;
}

export enum ContactType {
  VET = 'VET',
  DRIVER = 'DRIVER',
  SHELTER = 'SHELTER',
  USER = 'USER',
}

export interface LoadContactsResult {
  list: Contact[];
  total: number;
}

export function isVetContact(contact: Contact): contact is Contact {
  return contact.type === ContactType.VET;
}

export function isDriverContact(contact: Contact): contact is Contact {
  return contact.type === ContactType.DRIVER;
}

export function isShelterContact(contact: Contact): contact is Contact {
  return contact.type === ContactType.SHELTER;
}

export function isUserContact(contact: Contact): contact is Contact {
  return contact.type === ContactType.USER;
}
