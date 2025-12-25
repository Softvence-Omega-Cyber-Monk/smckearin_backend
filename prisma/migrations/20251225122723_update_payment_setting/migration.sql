-- DropIndex
DROP INDEX "transactions_stripePaymentIntentId_key";

-- DropIndex
DROP INDEX "transactions_stripeTransferId_key";

-- AlterTable
ALTER TABLE "payment_settings" ADD COLUMN     "automaticPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutDayOfMonth" INTEGER NOT NULL DEFAULT 1;
