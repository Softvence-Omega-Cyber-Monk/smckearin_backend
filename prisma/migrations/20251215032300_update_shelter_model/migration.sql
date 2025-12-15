/*
  Warnings:

  - Added the required column `name` to the `shelter_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `shelter_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "shelter_documents" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "shelterId" TEXT;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
