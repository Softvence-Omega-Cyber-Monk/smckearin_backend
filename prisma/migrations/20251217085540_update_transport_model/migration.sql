-- DropForeignKey
ALTER TABLE "transports" DROP CONSTRAINT "transports_shelterId_fkey";

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "vetId" TEXT;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "veterinarians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
