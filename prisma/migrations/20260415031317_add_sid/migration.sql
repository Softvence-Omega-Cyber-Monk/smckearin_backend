/*
  Warnings:

  - A unique constraint covering the columns `[sid]` on the table `animals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chatScope,transportId,adoptionId]` on the table `private_conversations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[initiatorId,receiverId,shelterId,chatScope,transportId,adoptionId]` on the table `private_conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AdoptionStatus" AS ENUM ('AVAILABLE', 'REQUESTED', 'ADOPTED', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterEnum
ALTER TYPE "ConversationScope" ADD VALUE 'ADOPTION';

-- AlterEnum
ALTER TYPE "SPECIES" ADD VALUE 'OTHER';

-- DropIndex
DROP INDEX "private_conversations_chatScope_transportId_key";

-- DropIndex
DROP INDEX "private_conversations_initiatorId_receiverId_shelterId_chat_key";

-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "sid" TEXT;

-- AlterTable
ALTER TABLE "private_conversations" ADD COLUMN     "adoptionId" TEXT;

-- CreateTable
CREATE TABLE "adoptions" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "adopterId" TEXT,
    "shelterId" TEXT NOT NULL,
    "status" "AdoptionStatus" NOT NULL DEFAULT 'PENDING',
    "spayNeuterAvailable" BOOLEAN NOT NULL DEFAULT false,
    "spayNeuterDate" TIMESTAMP(3),
    "lastCheckupDate" TIMESTAMP(3),
    "vaccinationsDate" TIMESTAMP(3),
    "personality" TEXT,
    "about" TEXT,
    "specialNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adoptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoption_requests" (
    "id" TEXT NOT NULL,
    "adoptionId" TEXT NOT NULL,
    "adopterId" TEXT NOT NULL,
    "note" TEXT,
    "status" "AdoptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adoption_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adoptions_animalId_key" ON "adoptions"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "animals_sid_key" ON "animals"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "private_conversations_chatScope_transportId_adoptionId_key" ON "private_conversations"("chatScope", "transportId", "adoptionId");

-- CreateIndex
CREATE UNIQUE INDEX "private_conversations_initiatorId_receiverId_shelterId_chat_key" ON "private_conversations"("initiatorId", "receiverId", "shelterId", "chatScope", "transportId", "adoptionId");

-- AddForeignKey
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_adopterId_fkey" FOREIGN KEY ("adopterId") REFERENCES "adopters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "adoptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_adopterId_fkey" FOREIGN KEY ("adopterId") REFERENCES "adopters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_conversations" ADD CONSTRAINT "private_conversations_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "adoptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
