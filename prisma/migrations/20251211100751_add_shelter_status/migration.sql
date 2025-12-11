-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Shelter" ADD COLUMN     "status" "ShelterStatus" NOT NULL DEFAULT 'PENDING';
