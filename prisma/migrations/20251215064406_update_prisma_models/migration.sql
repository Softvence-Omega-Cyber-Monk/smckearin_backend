/*
  Warnings:

  - A unique constraint covering the columns `[initiatorId,receiverId,shelterId]` on the table `private_conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "private_conversations_initiatorId_receiverId_key";

-- AlterTable
ALTER TABLE "private_conversations" ADD COLUMN     "shelterId" TEXT,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "private_conversations_initiatorId_receiverId_shelterId_key" ON "private_conversations"("initiatorId", "receiverId", "shelterId");

-- AddForeignKey
ALTER TABLE "private_conversations" ADD CONSTRAINT "private_conversations_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
