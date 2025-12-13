import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ApprovalStatus, Driver, Prisma, User } from '@prisma';
import { GetApprovedDrivers, GetDriversDto } from '../dto/get-drivers.dto';

@Injectable()
export class GetDriverService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get drivers')
  async getAllDrivers(dto: GetDriversDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.DriverWhereInput = {};

    // Apply search to related user info as well as driver fields
    if (dto.search) {
      where.OR = [
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
        { user: { email: { contains: dto.search, mode: 'insensitive' } } },
        { phone: { contains: dto.search, mode: 'insensitive' } },
        { state: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    // Filter by approval status
    if (dto.status) {
      const allowedStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED',
      ] as ApprovalStatus[];
      const statusUpper = dto.status.toUpperCase();

      if (allowedStatuses.includes(statusUpper as any)) {
        where.status = statusUpper as ApprovalStatus;
      }
      // else ignore the status filter
    }

    const [drivers, total] = await this.prisma.client.$transaction([
      this.prisma.client.driver.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true, // include user info
        },
      }),
      this.prisma.client.driver.count({ where }),
    ]);

    const flattenedDrivers = drivers.map(this.flattenDriver);

    return successPaginatedResponse(
      flattenedDrivers,
      { page, limit, total },
      'Drivers found',
    );
  }

  @HandleError('Failed to get approved drivers')
  async getApprovedDrivers(dto: GetApprovedDrivers) {
    return this.getAllDrivers({ ...dto, status: 'APPROVED' });
  }

  @HandleError('Failed to get single driver')
  async getSingleDriver(driverId: string) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { id: driverId },
      include: {
        user: true, // include user info
      },
    });

    const flattenedDriver = await this.flattenDriver(driver);

    return successResponse(flattenedDriver, 'Driver found');
  }

  private flattenDriver = (driver: Driver & { user: User }) => ({
    driverId: driver.id,
    userId: driver.user?.id,
    userName: driver.user?.name,
    userEmail: driver.user?.email,
    userRole: driver.user?.role,
    profilePictureUrl: driver.user?.profilePictureUrl,
    userPhone: driver.phone,
    state: driver.state,
    address: driver.address,
    vehicleType: driver.vehicleType,
    vehicleCapacity: driver.vehicleCapacity,
    yearsOfExperience: driver.yearsOfExperience,
    previousExperience: driver.previousExperience,
    startTime: driver.startTime,
    endTime: driver.endTime,
    status: driver.status,
    needsDriverLicense: !driver.driverLicenseUrl,
    driverLicenseStatus: driver.driverLicenseStatus,
    driverLicenseUrl: driver.driverLicenseUrl,
    needsVehicleRegistration: !driver.vehicleRegistrationUrl,
    vehicleRegistrationStatus: driver.vehicleRegistrationStatus,
    vehicleRegistrationUrl: driver.vehicleRegistrationUrl,
    needsTransportCertificate: !driver.transportCertificateUrl,
    transportCertificateStatus: driver.transportCertificateStatus,
    transportCertificateUrl: driver.transportCertificateUrl,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  });
}
