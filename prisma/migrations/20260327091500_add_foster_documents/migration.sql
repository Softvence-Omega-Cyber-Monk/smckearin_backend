-- CreateTable
CREATE TABLE "foster_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fosterId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foster_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "foster_documents_documentId_key" ON "foster_documents"("documentId");

-- AddForeignKey
ALTER TABLE "foster_documents" ADD CONSTRAINT "foster_documents_fosterId_fkey" FOREIGN KEY ("fosterId") REFERENCES "fosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foster_documents" ADD CONSTRAINT "foster_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "file_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
