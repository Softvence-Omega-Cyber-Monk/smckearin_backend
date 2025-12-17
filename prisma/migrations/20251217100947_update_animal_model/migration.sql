-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ADOPTED', 'AT_SHELTER', 'IN_TRANSIT');

-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'IN_TRANSIT';
