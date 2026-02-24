-- Add scoped conversation support for transport-specific chat boxes
CREATE TYPE "ConversationScope" AS ENUM ('MAIN', 'TRANSPORT');

ALTER TABLE "private_conversations"
ADD COLUMN "chatScope" "ConversationScope" NOT NULL DEFAULT 'MAIN',
ADD COLUMN "transportId" TEXT;

-- Replace old uniqueness with scope-aware uniqueness
DROP INDEX IF EXISTS "private_conversations_initiatorId_receiverId_shelterId_key";

CREATE UNIQUE INDEX "private_conversations_chatScope_transportId_key"
ON "private_conversations"("chatScope", "transportId");

CREATE UNIQUE INDEX "private_conversations_initiatorId_receiverId_shelterId_chatScope_transportId_key"
ON "private_conversations"("initiatorId", "receiverId", "shelterId", "chatScope", "transportId");

CREATE INDEX "private_conversations_chatScope_updatedAt_idx"
ON "private_conversations"("chatScope", "updatedAt");

ALTER TABLE "private_conversations"
ADD CONSTRAINT "private_conversations_transportId_fkey"
FOREIGN KEY ("transportId") REFERENCES "transports"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
