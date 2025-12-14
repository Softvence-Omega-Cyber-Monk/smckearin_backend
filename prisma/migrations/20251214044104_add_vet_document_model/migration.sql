-- CreateTable
CREATE TABLE "vet_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vet_documents_documentId_key" ON "vet_documents"("documentId");

-- AddForeignKey
ALTER TABLE "vet_documents" ADD CONSTRAINT "vet_documents_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_documents" ADD CONSTRAINT "vet_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "file_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
