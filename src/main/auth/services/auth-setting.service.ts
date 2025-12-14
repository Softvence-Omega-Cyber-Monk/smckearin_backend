import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma';
import { UpdateOperatingScheduleDto } from '../dto/setting.dto';

@Injectable()
export class AuthSettingService {
  constructor(private prisma: PrismaService) {}

  @HandleError('Failed to get operating schedule')
  async getOperatingSchedule(authUser: JWTPayload) {
    const { sub: userId, role } = authUser;

    switch (role) {
      case UserRole.DRIVER:
        const driver = await this.prisma.client.driver.findUnique({
          where: { userId },
          select: {
            startTime: true,
            endTime: true,
            workingDays: true,
          },
        });

        return successResponse(driver, 'Operating schedule found');

      case UserRole.VETERINARIAN:
        const veterinarian = await this.prisma.client.veterinarian.findUnique({
          where: { userId },
          select: {
            startTime: true,
            endTime: true,
            workingDays: true,
          },
        });

        return successResponse(veterinarian, 'Operating schedule found');

      case UserRole.SHELTER_ADMIN:
      case UserRole.MANAGER:
        const shelter = await this.prisma.client.shelter.findFirst({
          where: {
            OR: [
              { shelterAdmins: { some: { id: userId } } },
              { managers: { some: { id: userId } } },
            ],
          },
          select: {
            startTime: true,
            endTime: true,
            workingDays: true,
          },
        });
        if (!shelter) {
          throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
        }

        return successResponse(shelter, 'Operating schedule found');
    }
  }

  @HandleError('Failed to update operating schedule')
  async updateOperatingSchedule(
    authUser: JWTPayload,
    dto: UpdateOperatingScheduleDto,
  ) {
    const { sub: userId, role } = authUser;

    if (!dto.startTime || !dto.endTime || !dto.workingDays) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Missing required fields');
    }

    if (!userId) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'User not found');
    }

    switch (role) {
      case UserRole.DRIVER:
        await this.prisma.client.driver.update({
          where: { userId },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            workingDays: dto.workingDays,
          },
        });
        break;

      case UserRole.VETERINARIAN:
        await this.prisma.client.veterinarian.update({
          where: { userId },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            workingDays: dto.workingDays,
          },
        });
        break;

      case UserRole.SHELTER_ADMIN:
      case UserRole.MANAGER:
        const shelter = await this.prisma.client.shelter.findFirst({
          where: {
            OR: [
              { shelterAdmins: { some: { id: userId } } },
              { managers: { some: { id: userId } } },
            ],
          },
        });
        if (!shelter) {
          throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
        }
        await this.prisma.client.shelter.update({
          where: { id: shelter.id },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            workingDays: dto.workingDays,
          },
        });
        break;

      default:
        throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    return successResponse(null, 'Operating schedule updated');
  }
}
