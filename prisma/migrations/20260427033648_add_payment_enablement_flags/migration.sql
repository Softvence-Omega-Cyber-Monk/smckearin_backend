-- AlterTable
ALTER TABLE "payment_settings" ADD COLUMN     "adopterPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fosterPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shelterPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "veterinarianPaymentEnabled" BOOLEAN NOT NULL DEFAULT false;
