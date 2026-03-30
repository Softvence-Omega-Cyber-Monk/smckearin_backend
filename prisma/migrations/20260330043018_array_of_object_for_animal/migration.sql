/*
  Warnings:

  - You are about to drop the column `animalId` on the `transports` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "transports" DROP CONSTRAINT "transports_animalId_fkey";

-- AlterTable
ALTER TABLE "transports" DROP COLUMN "animalId";

-- CreateTable
CREATE TABLE "_TransportAnimals" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransportAnimals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TransportAnimals_B_index" ON "_TransportAnimals"("B");

-- AddForeignKey
ALTER TABLE "_TransportAnimals" ADD CONSTRAINT "_TransportAnimals_A_fkey" FOREIGN KEY ("A") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransportAnimals" ADD CONSTRAINT "_TransportAnimals_B_fkey" FOREIGN KEY ("B") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
