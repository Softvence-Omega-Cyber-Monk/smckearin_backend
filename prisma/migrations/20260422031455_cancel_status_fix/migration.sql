-- Safe migration for American English spelling refactor

-- 1. BatchStatus Rename
BEGIN;
CREATE TYPE "BatchStatus_new" AS ENUM ('PENDING', 'EXECUTED', 'CANCELED');
ALTER TABLE "transport_batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transport_batches" ALTER COLUMN "status" TYPE "BatchStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"BatchStatus_new";
ALTER TYPE "BatchStatus" RENAME TO "BatchStatus_old";
ALTER TYPE "BatchStatus_new" RENAME TO "BatchStatus";
DROP TYPE "BatchStatus_old";
ALTER TABLE "transport_batches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- 2. FosterRequestStatus Rename
BEGIN;
CREATE TYPE "FosterRequestStatus_new" AS ENUM ('REQUESTED', 'INTERESTED', 'APPROVED', 'SCHEDULED', 'DELIVERED', 'COMPLETED', 'CANCELED');
ALTER TABLE "foster_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "foster_requests" ALTER COLUMN "status" TYPE "FosterRequestStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"FosterRequestStatus_new";
ALTER TYPE "FosterRequestStatus" RENAME TO "FosterRequestStatus_old";
ALTER TYPE "FosterRequestStatus_new" RENAME TO "FosterRequestStatus";
DROP TYPE "FosterRequestStatus_old";
ALTER TABLE "foster_requests" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- 3. TransactionStatus Rename
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('PENDING', 'HOLD', 'PROCESSING', 'CHARGED', 'TRANSFERRED', 'FAILED', 'REFUNDED', 'CANCELED');
ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"TransactionStatus_new";
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "TransactionStatus_old";
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- 4. TransportStatus Rename
BEGIN;
CREATE TYPE "TransportStatus_new" AS ENUM ('PENDING', 'SCHEDULED', 'ACCEPTED', 'CANCELED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED');
ALTER TABLE "transports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transports" ALTER COLUMN "status" TYPE "TransportStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"TransportStatus_new";
ALTER TABLE "transport_timelines" ALTER COLUMN "status" TYPE "TransportStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"TransportStatus_new";
ALTER TYPE "TransportStatus" RENAME TO "TransportStatus_old";
ALTER TYPE "TransportStatus_new" RENAME TO "TransportStatus";
DROP TYPE "TransportStatus_old";
ALTER TABLE "transports" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- 5. VetAppointmentStatus Rename
BEGIN;
CREATE TYPE "VetAppointmentStatus_new" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED', 'MISSED');
ALTER TABLE "vet_appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "vet_appointments" ALTER COLUMN "status" TYPE "VetAppointmentStatus_new" USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELED' ELSE "status"::text END)::"VetAppointmentStatus_new";
ALTER TYPE "VetAppointmentStatus" RENAME TO "VetAppointmentStatus_old";
ALTER TYPE "VetAppointmentStatus_new" RENAME TO "VetAppointmentStatus";
DROP TYPE "VetAppointmentStatus_old";
ALTER TABLE "vet_appointments" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- 6. Column Renames (Safe RENAME instead of DROP/ADD)
ALTER TABLE "foster_animal_interests" RENAME COLUMN "cancelledAt" TO "canceledAt";
ALTER TABLE "foster_requests" RENAME COLUMN "cancelledAt" TO "canceledAt";
