/*
  Warnings:

  - A unique constraint covering the columns `[vetClearanceRequestId]` on the table `transports` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "vetClearanceRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transports_vetClearanceRequestId_key" ON "transports"("vetClearanceRequestId");

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_vetClearanceRequestId_fkey" FOREIGN KEY ("vetClearanceRequestId") REFERENCES "vet_clearance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
