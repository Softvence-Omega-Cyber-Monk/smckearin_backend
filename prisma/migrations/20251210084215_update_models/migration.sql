-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SPECIES" AS ENUM ('DOG', 'CAT');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TransportStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VetClearance" AS ENUM ('Health', 'Vaccination', 'Both', 'None');

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "species" "SPECIES" NOT NULL,
    "gender" "Gender" NOT NULL,
    "color" TEXT,
    "specialNeeds" TEXT,
    "medicalNotes" TEXT,
    "behaviorNotes" TEXT,
    "bondedWithId" TEXT,
    "shelterId" TEXT NOT NULL,
    "imageId" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transports" (
    "id" TEXT NOT NULL,
    "transportNote" TEXT NOT NULL,
    "priorityLevel" "PriorityLevel" NOT NULL,
    "pickUpLocation" TEXT NOT NULL,
    "pickUpLatitude" DOUBLE PRECISION NOT NULL,
    "pickUpLongitude" DOUBLE PRECISION NOT NULL,
    "dropOffLocation" TEXT NOT NULL,
    "dropOffLatitude" DOUBLE PRECISION NOT NULL,
    "dropOffLongitude" DOUBLE PRECISION NOT NULL,
    "transPortDate" TIMESTAMP(3) NOT NULL,
    "transPortTime" TIMESTAMP(3) NOT NULL,
    "animalId" TEXT NOT NULL,
    "driverId" TEXT,
    "veterinarianId" TEXT,
    "vetClearance" "VetClearance" NOT NULL,
    "status" "TransportStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animals_imageId_key" ON "animals"("imageId");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_bondedWithId_fkey" FOREIGN KEY ("bondedWithId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "veterinarians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
