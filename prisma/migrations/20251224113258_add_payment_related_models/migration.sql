/*
  Warnings:

  - A unique constraint covering the columns `[stripeAccountId]` on the table `drivers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `shelters` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('VOLUNTEER', 'PAID');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ComplexityType" AS ENUM ('STANDARD', 'PUPPY_KITTEN', 'MEDICAL', 'SPECIAL_HANDLING');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'HOLD', 'REFUNDED');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "payoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeAccountId" TEXT;

-- AlterTable
ALTER TABLE "shelters" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "transports" ADD COLUMN     "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'VOLUNTEER';

-- CreateTable
CREATE TABLE "animal_complexity_fees" (
    "id" TEXT NOT NULL,
    "type" "ComplexityType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "multiAnimalFlatFee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_complexity_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "driverPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "platformFeesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timeBasedPricingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "ratePerMile" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "ratePerMinute" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "baseFare" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "minPayout" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_snapshots" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "durationMinutes" DOUBLE PRECISION NOT NULL,
    "ratePerMile" DOUBLE PRECISION NOT NULL,
    "ratePerMinute" DOUBLE PRECISION NOT NULL,
    "distanceCost" DOUBLE PRECISION NOT NULL,
    "timeCost" DOUBLE PRECISION NOT NULL,
    "animalComplexityFee" DOUBLE PRECISION NOT NULL,
    "multiAnimalFee" DOUBLE PRECISION NOT NULL,
    "platformFeeAmount" DOUBLE PRECISION NOT NULL,
    "driverGrossPayout" DOUBLE PRECISION NOT NULL,
    "totalRideCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animal_complexity_fees_type_key" ON "animal_complexity_fees"("type");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_snapshots_transportId_key" ON "pricing_snapshots"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transportId_key" ON "transactions"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripePaymentIntentId_key" ON "transactions"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripeTransferId_key" ON "transactions"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_stripeAccountId_key" ON "drivers"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "shelters_stripeCustomerId_key" ON "shelters"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
