-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "bondedPairId" TEXT,
ADD COLUMN     "isBondedPair" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_bondedPairId_fkey" FOREIGN KEY ("bondedPairId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
