-- DropForeignKey
ALTER TABLE "animals" DROP CONSTRAINT "animals_shelterId_fkey";

-- AlterTable
ALTER TABLE "animals" ALTER COLUMN "shelterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
