/*
  Warnings:

  - You are about to drop the column `transPortTime` on the `transports` table. All the data in the column will be lost.
  - You are about to drop the column `appointmentTime` on the `vet_appointments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transports" DROP COLUMN "transPortTime";

-- AlterTable
ALTER TABLE "vet_appointments" DROP COLUMN "appointmentTime";
