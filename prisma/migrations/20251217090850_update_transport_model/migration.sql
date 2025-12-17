-- CreateEnum
CREATE TYPE "RequiredVetClearanceType" AS ENUM ('Health', 'Vaccination', 'Both', 'No');

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "vetClearanceType" "RequiredVetClearanceType" NOT NULL DEFAULT 'No',
ALTER COLUMN "isVetClearanceRequired" SET DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
