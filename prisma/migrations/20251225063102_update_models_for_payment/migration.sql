/*
  Warnings:

  - The values [SUCCEEDED] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `paymentEnabled` on the `transports` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMode` on the `transports` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeDefaultPaymentMethodId]` on the table `shelters` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('PENDING', 'HOLD', 'PROCESSING', 'CHARGED', 'TRANSFERRED', 'FAILED', 'REFUNDED', 'CANCELLED');
ALTER TABLE "public"."transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "payment_settings" ADD COLUMN     "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'VOLUNTEER';

-- AlterTable
ALTER TABLE "shelters" ADD COLUMN     "stripeDefaultPaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "transports" DROP COLUMN "paymentEnabled",
DROP COLUMN "paymentMode";

-- CreateIndex
CREATE UNIQUE INDEX "shelters_stripeDefaultPaymentMethodId_key" ON "shelters"("stripeDefaultPaymentMethodId");
