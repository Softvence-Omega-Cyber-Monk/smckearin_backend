-- CreateEnum
CREATE TYPE "FosterInterestStatus" AS ENUM ('INTERESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "foster_animal_interests" (
    "id" TEXT NOT NULL,
    "fosterId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "preferredArrivalDate" TIMESTAMP(3),
    "availableFromTime" TEXT NOT NULL,
    "availableUntilTime" TEXT NOT NULL,
    "receivingAddress" TEXT NOT NULL,
    "receivingPhone" TEXT NOT NULL,
    "status" "FosterInterestStatus" NOT NULL DEFAULT 'INTERESTED',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foster_animal_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foster_animal_interests_fosterId_status_idx" ON "foster_animal_interests"("fosterId", "status");

-- CreateIndex
CREATE INDEX "foster_animal_interests_animalId_status_idx" ON "foster_animal_interests"("animalId", "status");

-- CreateIndex
CREATE INDEX "foster_animal_interests_shelterId_status_idx" ON "foster_animal_interests"("shelterId", "status");

-- AddForeignKey
ALTER TABLE "foster_animal_interests" ADD CONSTRAINT "foster_animal_interests_fosterId_fkey" FOREIGN KEY ("fosterId") REFERENCES "fosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_animal_interests" ADD CONSTRAINT "foster_animal_interests_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_animal_interests" ADD CONSTRAINT "foster_animal_interests_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
