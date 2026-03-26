/*
  Warnings:

  - You are about to drop the column `address` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerificationExpiry` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerificationToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isEmailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profilePhotoKey` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profilePhotoUrl` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `foster_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `foster_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `foster_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operating_schedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "foster_documents" DROP CONSTRAINT "foster_documents_userId_fkey";

-- DropForeignKey
ALTER TABLE "foster_preferences" DROP CONSTRAINT "foster_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "foster_profiles" DROP CONSTRAINT "foster_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "operating_schedules" DROP CONSTRAINT "operating_schedules_userId_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_userId_fkey";

-- DropIndex
DROP INDEX "users_emailVerificationToken_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "emailVerificationExpiry",
DROP COLUMN "emailVerificationToken",
DROP COLUMN "isEmailVerified",
DROP COLUMN "phone",
DROP COLUMN "profilePhotoKey",
DROP COLUMN "profilePhotoUrl",
DROP COLUMN "state";

-- DropTable
DROP TABLE "foster_documents";

-- DropTable
DROP TABLE "foster_preferences";

-- DropTable
DROP TABLE "foster_profiles";

-- DropTable
DROP TABLE "operating_schedules";

-- DropTable
DROP TABLE "password_reset_tokens";

-- DropTable
DROP TABLE "user_settings";

-- DropEnum
DROP TYPE "DocumentStatus";

-- DropEnum
DROP TYPE "DocumentType";
