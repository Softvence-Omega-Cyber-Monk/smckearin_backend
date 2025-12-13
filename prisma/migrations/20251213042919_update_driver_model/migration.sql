-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "driverLicenseStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "transportCertificateStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "vehicleRegistrationStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
