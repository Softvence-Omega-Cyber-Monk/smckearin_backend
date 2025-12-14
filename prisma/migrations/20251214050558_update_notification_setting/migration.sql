-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "paymentNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tripNotifications" BOOLEAN NOT NULL DEFAULT true;
