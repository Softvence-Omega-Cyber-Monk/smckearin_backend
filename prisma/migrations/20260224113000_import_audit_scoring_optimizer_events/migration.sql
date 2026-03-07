-- Enums
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'EXTERNAL_FEED');
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE');
CREATE TYPE "ImportRowAction" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED', 'ERROR');
CREATE TYPE "PriorityScoreTriggerType" AS ENUM ('MANUAL', 'CRON', 'SYSTEM');
CREATE TYPE "OperationDomain" AS ENUM ('IMPORT', 'PRIORITY_SCORING', 'OPTIMIZER');
CREATE TYPE "OperationStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILURE', 'DUPLICATE');

-- Animal scoring formula version
ALTER TABLE "animals"
ADD COLUMN "priorityScoreFormulaVersion" TEXT NOT NULL DEFAULT 'v1.0.0';

-- Optimizer reproducibility fields
ALTER TABLE "transport_batches"
ADD COLUMN "optimizationInputSnapshot" JSONB,
ADD COLUMN "optimizationConstraintTrace" JSONB,
ADD COLUMN "optimizerVersion" TEXT NOT NULL DEFAULT 'heuristic-v1';

-- Import jobs
CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL,
  "shelterId" TEXT NOT NULL,
  "mappingTemplateId" TEXT,
  "sourceType" "ImportSourceType" NOT NULL DEFAULT 'CSV',
  "sourceFileName" TEXT,
  "sourceChecksum" TEXT,
  "fileSizeBytes" INTEGER,
  "idempotencyKey" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "auditLog" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_jobs_idempotencyKey_key" ON "import_jobs"("idempotencyKey");
CREATE INDEX "import_jobs_shelterId_createdAt_idx" ON "import_jobs"("shelterId", "createdAt");
CREATE INDEX "import_jobs_shelterId_sourceChecksum_idx" ON "import_jobs"("shelterId", "sourceChecksum");

ALTER TABLE "import_jobs"
ADD CONSTRAINT "import_jobs_shelterId_fkey"
FOREIGN KEY ("shelterId") REFERENCES "shelters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_jobs"
ADD CONSTRAINT "import_jobs_mappingTemplateId_fkey"
FOREIGN KEY ("mappingTemplateId") REFERENCES "import_mappings"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_jobs"
ADD CONSTRAINT "import_jobs_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Import row staging + row-level errors
CREATE TABLE "import_rows" (
  "id" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "mappedData" JSONB,
  "action" "ImportRowAction" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_rows_importJobId_rowNumber_idx" ON "import_rows"("importJobId", "rowNumber");
CREATE INDEX "import_rows_importJobId_action_idx" ON "import_rows"("importJobId", "action");

ALTER TABLE "import_rows"
ADD CONSTRAINT "import_rows_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Priority score history with formula version
CREATE TABLE "priority_score_logs" (
  "id" TEXT NOT NULL,
  "animalId" TEXT NOT NULL,
  "shelterId" TEXT,
  "formulaVersion" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "breakdown" JSONB NOT NULL,
  "details" TEXT[] NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "triggerType" "PriorityScoreTriggerType" NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "priority_score_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "priority_score_logs_animalId_createdAt_idx" ON "priority_score_logs"("animalId", "createdAt");
CREATE INDEX "priority_score_logs_shelterId_createdAt_idx" ON "priority_score_logs"("shelterId", "createdAt");

ALTER TABLE "priority_score_logs"
ADD CONSTRAINT "priority_score_logs_animalId_fkey"
FOREIGN KEY ("animalId") REFERENCES "animals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "priority_score_logs"
ADD CONSTRAINT "priority_score_logs_shelterId_fkey"
FOREIGN KEY ("shelterId") REFERENCES "shelters"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Structured operation events (Phase 3 style)
CREATE TABLE "operation_events" (
  "id" TEXT NOT NULL,
  "domain" "OperationDomain" NOT NULL,
  "action" TEXT NOT NULL,
  "status" "OperationStatus" NOT NULL,
  "correlationId" TEXT,
  "idempotencyKey" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "payload" JSONB,
  "errorMessage" TEXT,
  "shelterId" TEXT,
  "userId" TEXT,
  "animalId" TEXT,
  "importJobId" TEXT,
  "transportBatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operation_events_domain_createdAt_idx" ON "operation_events"("domain", "createdAt");
CREATE INDEX "operation_events_correlationId_idx" ON "operation_events"("correlationId");
CREATE INDEX "operation_events_entityType_entityId_idx" ON "operation_events"("entityType", "entityId");

ALTER TABLE "operation_events"
ADD CONSTRAINT "operation_events_shelterId_fkey"
FOREIGN KEY ("shelterId") REFERENCES "shelters"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operation_events"
ADD CONSTRAINT "operation_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operation_events"
ADD CONSTRAINT "operation_events_animalId_fkey"
FOREIGN KEY ("animalId") REFERENCES "animals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operation_events"
ADD CONSTRAINT "operation_events_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operation_events"
ADD CONSTRAINT "operation_events_transportBatchId_fkey"
FOREIGN KEY ("transportBatchId") REFERENCES "transport_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
