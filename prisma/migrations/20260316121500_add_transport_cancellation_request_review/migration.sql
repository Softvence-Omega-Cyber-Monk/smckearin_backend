-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "transports"
ADD COLUMN "cancellationRequestReason" TEXT,
ADD COLUMN "cancellationRequestReviewNote" TEXT,
ADD COLUMN "cancellationRequestReviewedAt" TIMESTAMP(3),
ADD COLUMN "cancellationRequestStatus" "CancellationRequestStatus",
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3);
