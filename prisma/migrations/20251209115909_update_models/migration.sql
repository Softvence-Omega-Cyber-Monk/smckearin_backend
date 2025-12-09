/*
  Warnings:

  - The values [USER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[profilePictureId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WorkingDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SHELTER_ADMIN', 'MANAGER', 'VETERINARIAN', 'DRIVER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managerOfId" TEXT,
ADD COLUMN     "profilePictureUrl" TEXT,
ADD COLUMN     "shelterAdminOfId" TEXT,
ALTER COLUMN "role" DROP DEFAULT;

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "vehicleCapacity" INTEGER NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "previousExperience" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 09:00:00 +00:00',
    "endTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 17:00:00 +00:00',
    "workingDays" "WorkingDay"[],
    "driverLicenseId" TEXT,
    "driverLicenseUrl" TEXT,
    "vehicleRegistrationId" TEXT,
    "vehicleRegistrationUrl" TEXT,
    "transportCertificateId" TEXT,
    "transportCertificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "certificateNotifications" BOOLEAN NOT NULL DEFAULT false,
    "appointmentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "logoId" TEXT,
    "logoUrl" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 09:00:00 +00:00',
    "endTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 17:00:00 +00:00',
    "workingDays" "WorkingDay"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinarians" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "license" TEXT,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 09:00:00 +00:00',
    "endTime" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 17:00:00 +00:00',
    "workingDays" "WorkingDay"[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veterinarians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_phone_key" ON "drivers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_driverLicenseId_key" ON "drivers"("driverLicenseId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_vehicleRegistrationId_key" ON "drivers"("vehicleRegistrationId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_transportCertificateId_key" ON "drivers"("transportCertificateId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shelter_logoId_key" ON "Shelter"("logoId");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_phone_key" ON "veterinarians"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_license_key" ON "veterinarians"("license");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_userId_key" ON "veterinarians"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_profilePictureId_key" ON "users"("profilePictureId");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_driverLicenseId_fkey" FOREIGN KEY ("driverLicenseId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicleRegistrationId_fkey" FOREIGN KEY ("vehicleRegistrationId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_transportCertificateId_fkey" FOREIGN KEY ("transportCertificateId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shelterAdminOfId_fkey" FOREIGN KEY ("shelterAdminOfId") REFERENCES "Shelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerOfId_fkey" FOREIGN KEY ("managerOfId") REFERENCES "Shelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinarians" ADD CONSTRAINT "veterinarians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
