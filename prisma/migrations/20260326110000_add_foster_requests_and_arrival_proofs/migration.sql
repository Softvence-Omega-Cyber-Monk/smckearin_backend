CREATE TYPE "FosterRequestStatus" AS ENUM (
    'REQUESTED',
    'INTERESTED',
    'APPROVED',
    'SCHEDULED',
    'DELIVERED',
    'CANCELLED'
);

CREATE TABLE "foster_requests" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "fosterUserId" TEXT,
    "shelterId" TEXT NOT NULL,
    "status" "FosterRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "deliveryTime" TIMESTAMP(3),
    "estimateTransportDate" TIMESTAMP(3),
    "estimateTransportTimeStart" TEXT,
    "estimateTransportTimeEnd" TEXT,
    "spayNeuterAvailable" BOOLEAN NOT NULL DEFAULT false,
    "spayNeuterDate" TIMESTAMP(3),
    "lastCheckupDate" TIMESTAMP(3),
    "vaccinationsDate" TIMESTAMP(3),
    "shelterNote" TEXT NOT NULL,
    "petPersonality" TEXT NOT NULL,
    "cancelReason" TEXT,
    "transportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foster_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arrival_proofs" (
    "id" TEXT NOT NULL,
    "fosterRequestId" TEXT NOT NULL,
    "photoId" TEXT,
    "photoUrl" TEXT NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arrival_proofs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "foster_requests_transportId_key" ON "foster_requests"("transportId");
CREATE UNIQUE INDEX "arrival_proofs_fosterRequestId_key" ON "arrival_proofs"("fosterRequestId");
CREATE UNIQUE INDEX "arrival_proofs_photoId_key" ON "arrival_proofs"("photoId");

CREATE INDEX "foster_requests_animalId_status_idx" ON "foster_requests"("animalId", "status");
CREATE INDEX "foster_requests_fosterUserId_status_idx" ON "foster_requests"("fosterUserId", "status");
CREATE INDEX "foster_requests_shelterId_status_idx" ON "foster_requests"("shelterId", "status");

ALTER TABLE "foster_requests"
ADD CONSTRAINT "foster_requests_animalId_fkey"
FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "foster_requests"
ADD CONSTRAINT "foster_requests_fosterUserId_fkey"
FOREIGN KEY ("fosterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "foster_requests"
ADD CONSTRAINT "foster_requests_shelterId_fkey"
FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "foster_requests"
ADD CONSTRAINT "foster_requests_transportId_fkey"
FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "arrival_proofs"
ADD CONSTRAINT "arrival_proofs_fosterRequestId_fkey"
FOREIGN KEY ("fosterRequestId") REFERENCES "foster_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "arrival_proofs"
ADD CONSTRAINT "arrival_proofs_photoId_fkey"
FOREIGN KEY ("photoId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transports"
ADD COLUMN "vehicleName" TEXT;
