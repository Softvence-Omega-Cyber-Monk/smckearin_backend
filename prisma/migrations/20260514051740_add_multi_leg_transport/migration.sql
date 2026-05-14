-- CreateEnum
CREATE TYPE "TransportLegStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "isMultiLeg" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "transport_legs" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "status" "TransportLegStatus" NOT NULL DEFAULT 'PENDING',
    "pickUpLocation" TEXT NOT NULL,
    "pickUpLatitude" DOUBLE PRECISION NOT NULL,
    "pickUpLongitude" DOUBLE PRECISION NOT NULL,
    "dropOffLocation" TEXT NOT NULL,
    "dropOffLatitude" DOUBLE PRECISION NOT NULL,
    "dropOffLongitude" DOUBLE PRECISION NOT NULL,
    "driverId" TEXT,
    "actualPickUpAt" TIMESTAMP(3),
    "actualDropOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_legs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_legs_transportId_idx" ON "transport_legs"("transportId");

-- CreateIndex
CREATE INDEX "transport_legs_driverId_idx" ON "transport_legs"("driverId");

-- AddForeignKey
ALTER TABLE "transport_legs" ADD CONSTRAINT "transport_legs_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_legs" ADD CONSTRAINT "transport_legs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
