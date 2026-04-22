/*
  Warnings:

  - The values [CANCELLED] on the enum `BatchStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `FosterRequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `TransportStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `VetAppointmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cancelledAt` on the `foster_animal_interests` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledAt` on the `foster_requests` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BatchStatus_new" AS ENUM ('PENDING', 'EXECUTED', 'CANCELED');
ALTER TABLE "public"."transport_batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transport_batches" ALTER COLUMN "status" TYPE "BatchStatus_new" USING ("status"::text::"BatchStatus_new");
ALTER TYPE "BatchStatus" RENAME TO "BatchStatus_old";
ALTER TYPE "BatchStatus_new" RENAME TO "BatchStatus";
DROP TYPE "public"."BatchStatus_old";
ALTER TABLE "transport_batches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "FosterRequestStatus_new" AS ENUM ('REQUESTED', 'INTERESTED', 'APPROVED', 'SCHEDULED', 'DELIVERED', 'COMPLETED', 'CANCELED');
ALTER TABLE "public"."foster_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "foster_requests" ALTER COLUMN "status" TYPE "FosterRequestStatus_new" USING ("status"::text::"FosterRequestStatus_new");
ALTER TYPE "FosterRequestStatus" RENAME TO "FosterRequestStatus_old";
ALTER TYPE "FosterRequestStatus_new" RENAME TO "FosterRequestStatus";
DROP TYPE "public"."FosterRequestStatus_old";
ALTER TABLE "foster_requests" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('PENDING', 'HOLD', 'PROCESSING', 'CHARGED', 'TRANSFERRED', 'FAILED', 'REFUNDED', 'CANCELED');
ALTER TABLE "public"."transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TransportStatus_new" AS ENUM ('PENDING', 'SCHEDULED', 'ACCEPTED', 'CANCELED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED');
ALTER TABLE "public"."transports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transports" ALTER COLUMN "status" TYPE "TransportStatus_new" USING ("status"::text::"TransportStatus_new");
ALTER TABLE "transport_timelines" ALTER COLUMN "status" TYPE "TransportStatus_new" USING ("status"::text::"TransportStatus_new");
ALTER TYPE "TransportStatus" RENAME TO "TransportStatus_old";
ALTER TYPE "TransportStatus_new" RENAME TO "TransportStatus";
DROP TYPE "public"."TransportStatus_old";
ALTER TABLE "transports" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VetAppointmentStatus_new" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED', 'MISSED');
ALTER TABLE "public"."vet_appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "vet_appointments" ALTER COLUMN "status" TYPE "VetAppointmentStatus_new" USING ("status"::text::"VetAppointmentStatus_new");
ALTER TYPE "VetAppointmentStatus" RENAME TO "VetAppointmentStatus_old";
ALTER TYPE "VetAppointmentStatus_new" RENAME TO "VetAppointmentStatus";
DROP TYPE "public"."VetAppointmentStatus_old";
ALTER TABLE "vet_appointments" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterTable
ALTER TABLE "foster_animal_interests" DROP COLUMN "cancelledAt",
ADD COLUMN     "canceledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "foster_requests" DROP COLUMN "cancelledAt",
ADD COLUMN     "canceledAt" TIMESTAMP(3);
