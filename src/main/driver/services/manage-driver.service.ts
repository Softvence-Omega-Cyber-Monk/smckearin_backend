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
    const uploadedFile = await this.s3.uploadFile(dto.file);

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

    return successResponse(null, `${dto.type} uploaded successfully`);
  }
}
