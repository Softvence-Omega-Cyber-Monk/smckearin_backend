-- RenameIndex (idempotent)
DO $$
BEGIN
  IF to_regclass('public.private_conversations_initiatorId_receiverId_shelterId_chatScop') IS NOT NULL
     AND to_regclass('public.private_conversations_initiatorId_receiverId_shelterId_chat_key') IS NULL THEN
    ALTER INDEX "private_conversations_initiatorId_receiverId_shelterId_chatScop"
      RENAME TO "private_conversations_initiatorId_receiverId_shelterId_chat_key";
  END IF;
END $$;
