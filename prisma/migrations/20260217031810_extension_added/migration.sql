/*
  Warnings:

  - A unique constraint covering the columns `[externalAnimalId]` on the table `animals` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuarantineStatus" AS ENUM ('CLEARED', 'QUARANTINE', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "HeartwormStatus" AS ENUM ('NEGATIVE', 'POSITIVE', 'TREATMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "clearedForTransport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "crateUnits" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "externalAnimalId" TEXT,
ADD COLUMN     "heartwormStatus" "HeartwormStatus",
ADD COLUMN     "intakeDate" TIMESTAMP(3),
ADD COLUMN     "intakeType" TEXT,
ADD COLUMN     "lastScoreUpdate" TIMESTAMP(3),
ADD COLUMN     "lengthOfStayDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "medicalHoldFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quarantineStatus" "QuarantineStatus" NOT NULL DEFAULT 'CLEARED',
ADD COLUMN     "rabiesExpiration" TIMESTAMP(3),
ADD COLUMN     "specialNeedsFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vaccinationsUpToDate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shelters" ADD COLUMN     "acceptsBreeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "acceptsSizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "acceptsSpecies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentUtilization" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "openKennels" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "restrictedBreeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totalKennels" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "external_feed_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "credentials" JSONB,
    "pollInterval" INTEGER NOT NULL DEFAULT 3600,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_feed_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shelterId" TEXT NOT NULL,
    "fieldMapping" JSONB NOT NULL,
    "transformations" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originShelterId" TEXT NOT NULL,
    "destinationShelterId" TEXT NOT NULL,
    "vehicleCapacity" DOUBLE PRECISION NOT NULL,
    "selectedAnimalIds" TEXT[],
    "totalPriorityScore" DOUBLE PRECISION NOT NULL,
    "totalCrateUnits" DOUBLE PRECISION NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "optimizationLog" JSONB NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animals_externalAnimalId_key" ON "animals"("externalAnimalId");

-- AddForeignKey
ALTER TABLE "external_feed_configs" ADD CONSTRAINT "external_feed_configs_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_batches" ADD CONSTRAINT "transport_batches_originShelterId_fkey" FOREIGN KEY ("originShelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_batches" ADD CONSTRAINT "transport_batches_destinationShelterId_fkey" FOREIGN KEY ("destinationShelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
