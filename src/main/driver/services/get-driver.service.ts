import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  Animal,
  ApprovalStatus,
  Driver,
  FileInstance,
  Prisma,
  Transport,
  User,
} from '@prisma';
import { GetApprovedDrivers, GetDriversDto } from '../dto/get-drivers.dto';

type DriverWithFiles = Driver & {
  user: User;
  driverLicense: FileInstance | null;
  vehicleRegistration: FileInstance | null;
  transportCertificate: FileInstance | null;
  transports?: (Transport & { animal: Animal })[];
};

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
          user: {
            include: {
              profilePicture: true,
            },
          },
          driverLicense: true,
          vehicleRegistration: true,
          transportCertificate: true,
          transports: {
            include: {
              animal: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
          },
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
    const driver: DriverWithFiles =
      await this.prisma.client.driver.findUniqueOrThrow({
        where: { id: driverId },
        include: {
          user: {
            include: {
              profilePicture: true,
            },
          },
          transports: {
            include: {
              animal: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          driverLicense: true,
          vehicleRegistration: true,
          transportCertificate: true,
        },
      });

    const flattenedDriver = await this.flattenDriver(driver);

    return successResponse(flattenedDriver, 'Driver found');
  }

  private flattenDriver = (driver: DriverWithFiles) => {
    const driverLicenseUrl = driver.driverLicenseUrl ?? null;
    const vehicleRegistrationUrl = driver.vehicleRegistrationUrl ?? null;
    const transportCertificateUrl = driver.transportCertificateUrl ?? null;

    // Calculate stats
    const totalAssigned = driver.transports?.length || 0;
    const completedTrips =
      driver.transports?.filter((t) => t.status === 'COMPLETED') ?? [];
    const totalTrips = completedTrips.length;

    // Completion Rate = (Completed / Total Assigned) * 100
    // If no trips assigned, rate is 0 (or 100? usually 0 if no history)
    const completionRate =
      totalAssigned > 0 ? Math.round((totalTrips / totalAssigned) * 100) : 0;

    // On-Time Rate
    // Based on completed trips where completedAt <= transPortDate (plus small buffer if needed, but strict for now)
    const onTimeTrips = completedTrips.filter((t) => {
      if (!t.completedAt) return false;
      // Allow 15 mins buffer? or strict? strict for now as per user request for "real data"
      return (
        new Date(t.completedAt).getTime() <= new Date(t.transPortDate).getTime()
      );
    }).length;

    const onTimeRate =
      totalTrips > 0 ? Math.round((onTimeTrips / totalTrips) * 100) : 0;

    const recentTrips =
      driver.transports?.slice(0, 5).map((t) => ({
        id: t.id,
        pet: t.animal?.name || 'Unknown Pet',
        date: t.transPortDate.toISOString().split('T')[0],
        status: t.status,
      })) || [];

    return {
      driverId: driver.id,
      userId: driver.user?.id,
      userName: driver.user?.name,
      userEmail: driver.user?.email,
      userRole: driver.user?.role,
      profilePictureUrl: driver.user?.profilePictureUrl,
      userPhone: driver.phone,
      state: driver.state,
      address: driver.address,
      workingDays: driver.workingDays,
      vehicleType: driver.vehicleType,
      vehicleCapacity: driver.vehicleCapacity,
      yearsOfExperience: driver.yearsOfExperience,
      previousExperience: driver.previousExperience,
      startTime: driver.startTime,
      endTime: driver.endTime,
      status: driver.status,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      // Stats
      trips: totalTrips,
      completionRate,
      onTimeRate,
      recentTrips,
      // Documents
      needsDriverLicense: !driverLicenseUrl,
      driverLicense: {
        type: 'Driver License',
        id: driver.driverLicenseId ?? null,
        url: driverLicenseUrl,
        status: driver.driverLicenseStatus,
        uploadedAt: driver.driverLicense?.updatedAt,
        documentType: driver.driverLicense?.mimeType,
      },
      needsVehicleRegistration: !vehicleRegistrationUrl,
      vehicleRegistration: {
        type: 'Vehicle Registration',
        id: driver.vehicleRegistrationId ?? null,
        url: vehicleRegistrationUrl,
        status: driver.vehicleRegistrationStatus,
        uploadedAt: driver.vehicleRegistration?.updatedAt,
        documentType: driver.vehicleRegistration?.mimeType,
      },
      needsTransportCertificate: !transportCertificateUrl,
      transportCertificate: {
        type: 'Transport Certificate',
        id: driver.transportCertificateId ?? null,
        url: transportCertificateUrl,
        status: driver.transportCertificateStatus,
        uploadedAt: driver.transportCertificate?.updatedAt,
        documentType: driver.transportCertificate?.mimeType,
      },
    };
  };
}
