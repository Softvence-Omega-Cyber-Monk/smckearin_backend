-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "currentLatitude" DOUBLE PRECISION,
ADD COLUMN     "currentLongitude" DOUBLE PRECISION,
ADD COLUMN     "lastLocationPing" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "acceptedAt" TIMESTAMP(3);
