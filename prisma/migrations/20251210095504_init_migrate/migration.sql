-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('VERIFICATION', 'RESET');

-- CreateEnum
CREATE TYPE "WorkingDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SPECIES" AS ENUM ('DOG', 'CAT');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('image', 'docs', 'link', 'document', 'any', 'video', 'audio');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'VOICE');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TransportStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'PICKED_UP', 'IN_TRANSIT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SHELTER_ADMIN', 'MANAGER', 'VETERINARIAN', 'DRIVER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "VetClearance" AS ENUM ('Health', 'Vaccination', 'Both');

-- CreateEnum
CREATE TYPE "VetClearanceRequestStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_EVALUATION', 'REJECTED', 'CERTIFIED', 'NOT_FIT', 'NEEDS_VISIT');

-- CreateEnum
CREATE TYPE "VetAppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED');

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "species" "SPECIES" NOT NULL,
    "gender" "Gender" NOT NULL,
    "color" TEXT,
    "specialNeeds" TEXT,
    "medicalNotes" TEXT,
    "behaviorNotes" TEXT,
    "bondedWithId" TEXT,
    "shelterId" TEXT NOT NULL,
    "imageId" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_otps" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "file_instances" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL DEFAULT 'any',
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_reports" (
    "id" TEXT NOT NULL,
    "veterinarianId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "reportId" TEXT,
    "reportIdUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "private_conversations" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "fileId" TEXT,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_message_statuses" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_message_statuses_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "transports" (
    "id" TEXT NOT NULL,
    "transportNote" TEXT NOT NULL,
    "priorityLevel" "PriorityLevel" NOT NULL,
    "pickUpLocation" TEXT NOT NULL,
    "pickUpLatitude" DOUBLE PRECISION NOT NULL,
    "pickUpLongitude" DOUBLE PRECISION NOT NULL,
    "dropOffLocation" TEXT NOT NULL,
    "dropOffLatitude" DOUBLE PRECISION NOT NULL,
    "dropOffLongitude" DOUBLE PRECISION NOT NULL,
    "transPortDate" TIMESTAMP(3) NOT NULL,
    "transPortTime" TIMESTAMP(3) NOT NULL,
    "animalId" TEXT NOT NULL,
    "driverId" TEXT,
    "isVetClearanceRequired" BOOLEAN NOT NULL,
    "status" "TransportStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Unnamed User',
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "profilePictureId" TEXT,
    "profilePictureUrl" TEXT,
    "shelterAdminOfId" TEXT,
    "managerOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_clearance_requests" (
    "id" TEXT NOT NULL,
    "vetClearance" "VetClearance" NOT NULL,
    "veterinarianId" TEXT,
    "status" "VetClearanceRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "notFitReasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_clearance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_appointments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "veterinarianId" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "VetAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_appointments_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "animals_imageId_key" ON "animals"("imageId");

-- CreateIndex
CREATE INDEX "user_otps_userId_idx" ON "user_otps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

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
CREATE UNIQUE INDEX "health_reports_reportId_key" ON "health_reports"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_userId_notificationId_key" ON "user_notifications"("userId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "private_conversations_initiatorId_receiverId_key" ON "private_conversations"("initiatorId", "receiverId");

-- CreateIndex
CREATE INDEX "private_messages_conversationId_createdAt_idx" ON "private_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "private_message_statuses_messageId_userId_key" ON "private_message_statuses"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shelter_logoId_key" ON "Shelter"("logoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_profilePictureId_key" ON "users"("profilePictureId");

-- CreateIndex
CREATE UNIQUE INDEX "vet_appointments_requestId_key" ON "vet_appointments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_phone_key" ON "veterinarians"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_license_key" ON "veterinarians"("license");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_userId_key" ON "veterinarians"("userId");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_bondedWithId_fkey" FOREIGN KEY ("bondedWithId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_otps" ADD CONSTRAINT "user_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_driverLicenseId_fkey" FOREIGN KEY ("driverLicenseId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicleRegistrationId_fkey" FOREIGN KEY ("vehicleRegistrationId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_transportCertificateId_fkey" FOREIGN KEY ("transportCertificateId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_reports" ADD CONSTRAINT "health_reports_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_reports" ADD CONSTRAINT "health_reports_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_reports" ADD CONSTRAINT "health_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_conversations" ADD CONSTRAINT "private_conversations_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_conversations" ADD CONSTRAINT "private_conversations_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_conversations" ADD CONSTRAINT "private_conversations_lastMessageId_fkey" FOREIGN KEY ("lastMessageId") REFERENCES "private_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "private_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_message_statuses" ADD CONSTRAINT "private_message_statuses_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "private_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_message_statuses" ADD CONSTRAINT "private_message_statuses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profilePictureId_fkey" FOREIGN KEY ("profilePictureId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shelterAdminOfId_fkey" FOREIGN KEY ("shelterAdminOfId") REFERENCES "Shelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerOfId_fkey" FOREIGN KEY ("managerOfId") REFERENCES "Shelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clearance_requests" ADD CONSTRAINT "vet_clearance_requests_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "veterinarians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_appointments" ADD CONSTRAINT "vet_appointments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "vet_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_appointments" ADD CONSTRAINT "vet_appointments_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "veterinarians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinarians" ADD CONSTRAINT "veterinarians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
