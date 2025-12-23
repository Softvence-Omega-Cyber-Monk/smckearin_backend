import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma';
import {
  DocumentApproveDto,
  DriverDocumentDeleteDto,
  DriverDocumentType,
  UploadDocumentDto,
} from '../dto/driver.dto';

@Injectable()
export class ManageDriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Failed to approve or reject driver')
  async approveOrRejectDriver(driverId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    await this.prisma.client.driver.update({
      where: { id: driverId },
      data: { status },
    });

    // TODO: NOTIFICATION - Driver Approval Status Changed
    // What: Send notification about driver approval/rejection decision
    // Recipients: The driver user (via driver.userId)
    // Settings: emailNotifications
    // Meta: { driverId, status, approved: dto.approved }

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} driver`,
    );
  }

  @HandleError('Failed to delete driver')
  async deleteDriver(driverId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!driver) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
      }

      // TODO: NOTIFICATION - Driver Account Deletion
      // What: Send notification about driver account deletion (send BEFORE deletion)
      // Recipients: The driver user (driver.userId)
      // Settings: emailNotifications
      // Meta: { driverId: driver.id, driverName: (fetch from user), driverEmail: (fetch from user) }
      // Note: Fetch user details BEFORE deletion to send notification

      // 1Delete driver first
      await tx.driver.delete({
        where: { id: driverId },
      });

      // Delete user
      await tx.user.delete({
        where: { id: driver.userId },
      });

      return successResponse(null, 'Driver and user deleted successfully');
    });
  }

  @HandleError('Failed to delete driver document')
  async deleteDriverDocument(
    authUser: JWTPayload,
    dto: DriverDocumentDeleteDto,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: authUser.sub },
    });

    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId: user.id },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    const deleteMap = {
      [DriverDocumentType.DRIVER_LICENSE]: {
        fileId: driver.driverLicenseId,
        update: {
          driverLicenseId: null,
          driverLicenseUrl: null,
          driverLicenseStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.VEHICLE_REGISTRATION]: {
        fileId: driver.vehicleRegistrationId,
        update: {
          vehicleRegistrationId: null,
          vehicleRegistrationUrl: null,
          vehicleRegistrationStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.TRANSPORT_CERTIFICATE]: {
        fileId: driver.transportCertificateId,
        update: {
          transportCertificateId: null,
          transportCertificateUrl: null,
          transportCertificateStatus: ApprovalStatus.PENDING,
        },
      },
    };

    const config = deleteMap[dto.type];

    if (!config || !config.fileId) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    await this.prisma.client.driver.update({
      where: { id: driver.id },
      data: config.update,
    });

    await this.s3.deleteFile(config.fileId);

    return successResponse(null, `${dto.type} deleted successfully`);
  }

  @HandleError('Failed to delete driver document')
  async deleteDriverDocumentBuAdmin(
    driverId: string,
    authUser: JWTPayload,
    dto: DriverDocumentDeleteDto,
  ) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { id: driverId },
      include: {
        driverLicense: true,
        vehicleRegistration: true,
        transportCertificate: true,
      },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    const isAdmin =
      authUser.role === UserRole.ADMIN ||
      authUser.role === UserRole.SUPER_ADMIN;
    const isOwner = driver.userId === authUser.sub;

    if (!isAdmin && !isOwner) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    const deleteMap = {
      [DriverDocumentType.DRIVER_LICENSE]: {
        fileId: driver.driverLicenseId,
        update: {
          driverLicenseId: null,
          driverLicenseUrl: null,
          driverLicenseStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.VEHICLE_REGISTRATION]: {
        fileId: driver.vehicleRegistrationId,
        update: {
          vehicleRegistrationId: null,
          vehicleRegistrationUrl: null,
          vehicleRegistrationStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.TRANSPORT_CERTIFICATE]: {
        fileId: driver.transportCertificateId,
        update: {
          transportCertificateId: null,
          transportCertificateUrl: null,
          transportCertificateStatus: ApprovalStatus.PENDING,
        },
      },
    };

    const config = deleteMap[dto.type];

    if (!config?.fileId) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    await this.prisma.client.driver.update({
      where: { id: driverId },
      data: {
        ...config.update,
      },
    });

    await this.s3.deleteFile(config.fileId);

    return successResponse(null, `${dto.type} deleted successfully`);
  }

  @HandleError('Failed to get own driver documents')
  async getMyDriverDocuments(authUser: JWTPayload) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId: authUser.sub },
      include: {
        driverLicense: true,
        vehicleRegistration: true,
        transportCertificate: true,
      },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver profile not found');
    }

    const driverLicenseUrl = driver.driverLicenseUrl ?? null;
    const vehicleRegistrationUrl = driver.vehicleRegistrationUrl ?? null;
    const transportCertificateUrl = driver.transportCertificateUrl ?? null;

    return successResponse(
      {
        needsDriverLicense: !driverLicenseUrl,
        driverLicense: {
          type: 'Driver License',
          id: driver.driverLicenseId ?? null,
          url: driverLicenseUrl,
          status: driver.driverLicenseStatus,
          uploadedAt: driver.driverLicense?.updatedAt ?? null,
          documentType: driver.driverLicense?.mimeType ?? null,
        },
        needsVehicleRegistration: !vehicleRegistrationUrl,
        vehicleRegistration: {
          type: 'Vehicle Registration',
          id: driver.vehicleRegistrationId ?? null,
          url: vehicleRegistrationUrl,
          status: driver.vehicleRegistrationStatus,
          uploadedAt: driver.vehicleRegistration?.updatedAt ?? null,
          documentType: driver.vehicleRegistration?.mimeType ?? null,
        },
        needsTransportCertificate: !transportCertificateUrl,
        transportCertificate: {
          type: 'Transport Certificate',
          id: driver.transportCertificateId ?? null,
          url: transportCertificateUrl,
          status: driver.transportCertificateStatus,
          uploadedAt: driver.transportCertificate?.updatedAt ?? null,
          documentType: driver.transportCertificate?.mimeType ?? null,
        },
      },
      'Driver documents retrieved successfully',
    );
  }

  @HandleError('Failed to upload driver document')
  async uploadDriverDocument(userId: string, dto: UploadDocumentDto) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { userId },
      include: {
        driverLicense: true,
        vehicleRegistration: true,
        transportCertificate: true,
      },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver profile not found');
    }

    // Delete previous file
    if (dto.type === DriverDocumentType.DRIVER_LICENSE) {
      if (driver.driverLicenseId) {
        await this.s3.deleteFile(driver.driverLicenseId);
      }
    } else if (dto.type === DriverDocumentType.VEHICLE_REGISTRATION) {
      if (driver.vehicleRegistrationId) {
        await this.s3.deleteFile(driver.vehicleRegistrationId);
      }
    } else if (dto.type === DriverDocumentType.TRANSPORT_CERTIFICATE) {
      if (driver.transportCertificateId) {
        await this.s3.deleteFile(driver.transportCertificateId);
      }
    }

    // Upload file
    const uploadedFile = await this.s3.uploadFile(dto.document);

    const updateMap = {
      [DriverDocumentType.DRIVER_LICENSE]: {
        data: {
          driverLicenseId: uploadedFile.id,
          driverLicenseUrl: uploadedFile.url,
          driverLicenseStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.VEHICLE_REGISTRATION]: {
        data: {
          vehicleRegistrationId: uploadedFile.id,
          vehicleRegistrationUrl: uploadedFile.url,
          vehicleRegistrationStatus: ApprovalStatus.PENDING,
        },
      },
      [DriverDocumentType.TRANSPORT_CERTIFICATE]: {
        data: {
          transportCertificateId: uploadedFile.id,
          transportCertificateUrl: uploadedFile.url,
          transportCertificateStatus: ApprovalStatus.PENDING,
        },
      },
    };

    const config = updateMap[dto.type];

    if (!config) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Invalid document type');
    }

    await this.prisma.client.driver.update({
      where: { id: driver.id },
      data: config.data,
    });

    // TODO: NOTIFICATION - New Driver Document Uploaded
    // What: Send notification about new driver document requiring approval
    // Recipients: All users with role SUPER_ADMIN or ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { driverId: driver.id, driverName: (fetch from user), documentType: dto.type, documentId: uploadedFile.id }

    return successResponse(uploadedFile, `${dto.type} uploaded successfully`);
  }

  @HandleError('Failed to approve or reject driver document')
  async approveOrRejectDriverDocument(
    driverId: string,
    dto: DocumentApproveDto,
  ) {
    const driver = await this.prisma.client.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        driverLicenseId: true,
        vehicleRegistrationId: true,
        transportCertificateId: true,
      },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    const status = dto.approved
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.REJECTED;

    const updateMap = {
      [DriverDocumentType.DRIVER_LICENSE]: {
        fileId: driver.driverLicenseId,
        data: {
          driverLicenseStatus: status,
        },
      },
      [DriverDocumentType.VEHICLE_REGISTRATION]: {
        fileId: driver.vehicleRegistrationId,
        data: {
          vehicleRegistrationStatus: status,
        },
      },
      [DriverDocumentType.TRANSPORT_CERTIFICATE]: {
        fileId: driver.transportCertificateId,
        data: {
          transportCertificateStatus: status,
        },
      },
    };

    const config = updateMap[dto.type];

    if (!config?.fileId) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    await this.prisma.client.driver.update({
      where: { id: driverId },
      data: config.data,
    });

    // TODO: NOTIFICATION - Driver Document Approval Status Changed
    // What: Send notification about driver document approval/rejection
    // Recipients: The driver user (via driver.userId)
    // Settings: emailNotifications, certificateNotifications
    // Meta: { driverId, documentType: dto.type, status, approved: dto.approved }

    return successResponse(
      null,
      `${dto.type} ${dto.approved ? 'approved' : 'rejected'} successfully`,
    );
  }
}
