-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'FOSTER';

-- CreateTable
CREATE TABLE "fosters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "animalType" TEXT NOT NULL,
    "sizePreference" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "preferredLocation" TEXT NOT NULL,
    "preferredMile" DOUBLE PRECISION NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fosters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fosters_userId_key" ON "fosters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fosters_phone_key" ON "fosters"("phone");

-- AddForeignKey
ALTER TABLE "fosters" ADD CONSTRAINT "fosters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
