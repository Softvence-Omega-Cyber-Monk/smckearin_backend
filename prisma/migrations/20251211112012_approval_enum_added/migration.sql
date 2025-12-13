/*
  Warnings:

  - The `status` column on the `Shelter` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Shelter" DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "veterinarians" ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "ShelterStatus";
