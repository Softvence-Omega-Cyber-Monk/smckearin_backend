/*
  Warnings:

  - A unique constraint covering the columns `[interestId]` on the table `arrival_proofs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "FosterInterestStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'FOSTERED';

-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "fosteredById" TEXT;

-- AlterTable
ALTER TABLE "arrival_proofs" ADD COLUMN     "interestId" TEXT,
ALTER COLUMN "fosterRequestId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "arrival_proofs_interestId_key" ON "arrival_proofs"("interestId");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_fosteredById_fkey" FOREIGN KEY ("fosteredById") REFERENCES "fosters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrival_proofs" ADD CONSTRAINT "arrival_proofs_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "foster_animal_interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
