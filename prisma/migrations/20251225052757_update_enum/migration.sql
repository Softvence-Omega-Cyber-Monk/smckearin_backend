-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "completedAt" TIMESTAMP(3);
