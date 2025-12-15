export enum EventsEnum {
  // === Generic status events ===
  ERROR = 'error', // Server -> Client: operation failed
  SUCCESS = 'success', // Server -> Client: operation succeeded

  // === Messaging ===
  MESSAGE_SEND = 'private:message_send', // Client -> Server: send a new message
  MESSAGE_NEW = 'private:message_new', // Server -> other participant: new message delivered
  MESSAGE_STATUS_UPDATE = 'private:message_status_update', // Server -> Client: delivered/read updates
  MESSAGE_MARK_READ = 'private:message_mark_read', // Client -> Server: mark messages as read

  // === Conversation ===
  CONVERSATION_LOAD_LIST = 'private:conversation_load_list', // Client -> Server
  CONVERSATION_LIST_RESPONSE = 'private:conversation_list_response', // Server -> Client (paginated)
  CONVERSATION_LOAD = 'private:conversation_load', // Client -> Server (single)
  CONVERSATION_RESPONSE = 'private:conversation_response', // Server -> Client (single)
  CONVERSATION_DELETE = 'private:conversation_delete', // Client -> Server: request delete
  CONVERSATION_ARCHIVE = 'private:conversation_archive', // Client -> Server: archive conversation
  CONVERSATION_BLOCK = 'private:conversation_block', // Client -> Server: block conversation
  CONVERSATION_UNBLOCK = 'private:conversation_unblock', // Client -> Server: unblock conversation
}

export enum QueueEventsEnum {
  // === Notification events ===
  NOTIFICATION = 'queue:notification',
  MESSAGES = 'queue:messages',
  GENERIC = 'queue:generic',
}
