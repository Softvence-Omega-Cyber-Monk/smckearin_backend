-- CreateTable
CREATE TABLE "transport_timelines" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "status" "TransportStatus" NOT NULL,
    "note" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_timelines_transportId_idx" ON "transport_timelines"("transportId");

-- AddForeignKey
ALTER TABLE "transport_timelines" ADD CONSTRAINT "transport_timelines_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
