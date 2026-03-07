# Chat Module - Frontend Implementation Guide

This document outlines the API for the real-time Chat module. The chat is implemented using **Socket.IO** (WebSockets) in the [ChatGateway](file:///c:/Users/sajib/code/smckearin_backend/src/lib/chat/chat.gateway.ts#14-88).

## 1. Connection & Authentication

- **Endpoint**: `https://api.yourdomain.com/chat` (or `http://localhost:3000/chat`)
- **Transport**: Socket.IO (WebSocket)
- **Authentication**: JWT Token

### Connection Process

You must pass the JWT token during the handshake. The server disconnects immediately if the token is invalid or missing.

**Client-Side Code (React/Vue/Angular Example):**

```typescript
import { io, Socket } from 'socket.io-client';

// Initializes socket connection
export const connectToChat = (token: string): Socket => {
  const socket = io('http://localhost:3000/chat', {
    auth: {
      token: token, // Sent as "client.handshake.auth.token"
    },
    // Backup: Headers (some gateways/proxies strip headers on handshake, so auth object is preferred)
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
    transports: ['websocket'], // Force WebSocket to avoid polling issues
  });

  socket.on('connect', () => {
    console.log('Connected to chat', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Connection failed:', err.message);
    // Common errors: "Missing token", "Invalid token", "User not found"
  });

  return socket;
};
```

---

## 2. Event Reference

### Global Events

| Event     | Direction        | Payload                 | Description                                                |
| :-------- | :--------------- | :---------------------- | :--------------------------------------------------------- |
| `success` | Server -> Client | `{ data: UserProfile }` | Emitted immediately after successful auth.                 |
| `error`   | Server -> Client | `{ message: string }`   | Emitted when an operation fails (e.g., malformed payload). |

### Conversation Events

| Event                                | Direction        | Payload Type                                                                                                                | Description                                   |
| :----------------------------------- | :--------------- | :-------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| `private:conversation_load_list`     | Client -> Server | [LoadConversationsDto](file:///c:/Users/sajib/code/smckearin_backend/src/lib/chat/dto/conversation.dto.ts#12-25)            | Request list of contacts/conversations.       |
| `private:conversation_list_response` | Server -> Client | `PaginatedResponse<Contact>`                                                                                                | Returns the contact list.                     |
| `private:conversation_load`          | Client -> Server | [InitOrLoadSingleConversationDto](file:///c:/Users/sajib/code/smckearin_backend/src/lib/chat/dto/conversation.dto.ts#27-36) | Load specific conversation (User or Shelter). |
| `private:conversation_response`      | Server -> Client | `Response<SingleConversationResponse>`                                                                                      | Returns conversation details + messages.      |

### Message Events

| Event                           | Direction        | Payload Type                                                                                          | Description                                            |
| :------------------------------ | :--------------- | :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `private:message_send`          | Client -> Server | [SendMessageDto](file:///c:/Users/sajib/code/smckearin_backend/src/lib/chat/dto/message.dto.ts#28-34) | Send a text or file message.                           |
| `private:message_new`           | Server -> Client | `Response<FormattedMessage>`                                                                          | Emitted to **Sender** (ack) and **Recipient**.         |
| `private:message_mark_read`     | Client -> Server | [MarkReadDto](file:///c:/Users/sajib/code/smckearin_backend/src/lib/chat/dto/message.dto.ts#35-42)    | Request to mark messages as seen.                      |
| `private:message_status_update` | Server -> Client | `Response<ReadStatus>`                                                                                | Emitted to **Original Sender** when their msg is read. |

---

## 3. Data Structures

The following Typescript interfaces match the backend DTOs and Logic.

### Enums

```typescript
export enum ConversationType {
  VET = 'VET',
  DRIVER = 'DRIVER',
  SHELTER = 'SHELTER',
}

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
}

export enum MessageDeliveryStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED', // Not currently used via socket, but exists in DB
  SEEN = 'SEEN',
}
```

### Request Payloads

```typescript
// 1. Load Contact List
interface LoadConversationsDto {
  page?: number; // default 1
  limit?: number; // default 20
  search?: string; // Filter by name
  type?: ConversationType; // Filter by specific type
}

// 2. Load Single Conversation
interface InitOrLoadSingleConversationDto {
  id: string; // The ID of the User or Shelter you want to chat with
  type: ConversationType;
  page?: number; // Message pagination (default 1)
  limit?: number; // Message pagination (default 20) -- Note: backend might use 50
}

// 3. Send Message
interface SendMessageDto {
  conversationId: string;
  content?: string; // Required if type is TEXT
  type?: MessageType; // Defaults to TEXT
  fileId?: string; // Required if type is FILE
}

// 4. Mark Read
interface MarkReadDto {
  messageIds: string[];
}
```

### Response Objects

**1. Contact (Conversation List Item)**

```typescript
interface Contact {
  id: string; // Target User/Shelter ID
  name: string;
  type: 'VET' | 'DRIVER' | 'SHELTER' | 'USER';
  avatarUrl: string; // UI Avatar or User Profile Pic
  isActive: boolean; // True if target (or any shelter staff) is found in socket register
  lastMessage: string;
  lastMessageAt: string | null; // Date String (ISO)
  conversationId: string | null; // Null if no conversation exists yet (Directory view)
}
```

**2. SingleConversationResponse**

```typescript
interface SingleConversationResponse {
  conversationId: string;
  type: ConversationType;
  participant: {
    id: string;
    name: string;
    role: string;
    avatarUrl: string;
    isActive: boolean;
    type: string; // VET, DRIVER, etc.
  };
  messages: FormattedMessage[];
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
}
```

**3. FormattedMessage & ReadBy**

```typescript
interface FormattedMessage {
  id: string;
  content: string;
  type: MessageType; // 'TEXT' | 'FILE'
  sender: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  fileUrl: string | null; // If type=FILE, this has the public URL
  file: {
    id: string;
    fileType: string;
    mimeType: string;
    size: number; // Bytes
  } | null;

  // Client Logic Helpers
  isMine: boolean; // True if current user sent it
  isFromShelter: boolean; // True if sender is acting as shelter staff
  isFromVet: boolean;
  isFromDriver: boolean;

  // Read Status
  isRead: boolean; // True if at least one other participant saw it
  readBy: ReadByParticipant[]; // Array of people who saw it

  createdAt: string;
  updatedAt: string;
}

interface ReadByParticipant {
  id: string;
  name: string;
  type: string; // VET, DRIVER, SHELTER (if 'Shelter' read it), USER
}
```

---

## 4. Workflows

### Scenario 1: User navigates to Chat Tab

1. **Connect**: Frontend calls `connectToChat(token)`.
2. **Listen**: Set up listeners for `private:message_new`.
3. **Load Contacts**:
   - Build UI loader.
   - Emit `private:conversation_load_list` with `page: 1`.
   - On `private:conversation_list_response`: Render list of contacts/conversations on left sidebar.

### Scenario 2: User clicks a Contact

1. **Identify Target**: User clicks "Dr. Smith" (id: `123`, type: `VET`).
2. **Load Conversation**:
   - Emit `private:conversation_load` with `{ id: '123', type: 'VET' }`.
3. **Handle Response**:
   - On `private:conversation_response`:
     - Save `conversationId` from payload (needed to send messages).
     - Render `messages`.
     - Scroll to bottom.
     - **Note**: The backend automatically marks unseen messages as SEEN when this is loaded.

### Scenario 3: Sending a Message

1. **User Types** "Hello" and hits Send.
2. **Optimistic UI** (Optional): Append "Hello" to UI immediately with "Sending..." state.
3. **Emit**: `private:message_send` with `{ conversationId: '...', content: 'Hello' }`.
4. **Confirm**:
   - On `private:message_new` with `isMine: true`, replace optimistic message with real message (confirmed ID, timestamp).

### Scenario 4: Real-time Incoming Message

1. **Event**: `private:message_new` received.
2. **Check Context**:
   - **If (currentConversation.id === payload.data.conversationId)**:
     - Append to message list.
     - **Important**: Emit `private:message_mark_read` with `[payload.data.id]` to let sender know we saw it.
   - **Else**:
     - Show notification toast or red badge on the relevant contact in the sidebar.

### Scenario 5: Read Receipts

1. **Event**: `private:message_status_update` received.
2. **Update UI**:
   - Find message by `messageId`.
   - Update its status to "Read" or show the "Read by [Name]" tooltip.

---

## 5. Error Handling

- **Socket Disconnect**:
  - Listen to [disconnect](file:///c:/Users/sajib/code/smckearin_backend/src/core/socket/base.gateway.ts#111-117). If `reason === "io server disconnect"`, the server forced disconnect (likely auth invalid). Do NOT auto-reconnect. You need to re-login.
  - If `reason === "transport close"`, connection lost (wifi/network). Socket.IO will auto-reconnect.
- **API Errors**:
  - All emits generally acknowledge via specific response events, but global `error` event captures execution exceptions.
  - Always listen to `error` and display a toast `err.message`.

## 6. Shelter Logic Niche Cases

- **Shelter Identity**: If a user is a Shelter Admin or Manager, they can chat _as_ the Shelter.
- **Shelter Messages**:
  - When a User chats with a Shelter, the conversation `type` is `SHELTER`.
  - The `participant` will be the Shelter entity (Name = Shelter Name, Avatar = Logo).
  - When a Shelter Staff replies, `isFromShelter` will be true.
  - When **ANY** staff member (Admin/Manager) reads a message, it is marked as read by the "Shelter".
  - `private:message_new` is broadcast to **ALL** online staff members of that shelter.
