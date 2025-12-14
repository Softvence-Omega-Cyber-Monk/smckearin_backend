import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole, WorkingDay } from '@prisma';
import { UpdateOperatingScheduleDto } from '../dto/setting.dto';

@Injectable()
export class AuthSettingService {
  constructor(private prisma: PrismaService) {}

  @HandleError('Failed to get operating schedule')
  async getOperatingSchedule(authUser: JWTPayload) {
    const { sub: userId, role } = authUser;

    let data: {
      startTime: string;
      endTime: string;
      workingDays: WorkingDay[];
    } | null = null;

    switch (role) {
      case UserRole.DRIVER:
        data = await this.prisma.client.driver.findUnique({
          where: { userId },
          select: { startTime: true, endTime: true, workingDays: true },
        });
        break;

      case UserRole.VETERINARIAN:
        data = await this.prisma.client.veterinarian.findUnique({
          where: { userId },
          select: { startTime: true, endTime: true, workingDays: true },
        });
        break;

      case UserRole.SHELTER_ADMIN:
      case UserRole.MANAGER:
        data = await this.prisma.client.shelter.findFirst({
          where: {
            OR: [
              { shelterAdmins: { some: { id: userId } } },
              { managers: { some: { id: userId } } },
            ],
          },
          select: { startTime: true, endTime: true, workingDays: true },
        });
        break;
    }

    if (!data) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Operating schedule not found');
    }

    return successResponse(
      {
        startTime: data.startTime,
        endTime: data.endTime,
        workingDays: this.formatWorkingDaysForResponse(data.workingDays),
      },
      'Operating schedule found',
    );
  }

  @HandleError('Failed to update operating schedule')
  async updateOperatingSchedule(
    authUser: JWTPayload,
    dto: UpdateOperatingScheduleDto,
  ) {
    const { sub: userId, role } = authUser;

    if (!userId) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'User not found');
    }

    const workingDays = this.parseWorkingDaysStrict(dto.workingDays);

    switch (role) {
      case UserRole.DRIVER:
        await this.prisma.client.driver.update({
          where: { userId },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            workingDays,
          },
        });
        break;

      case UserRole.VETERINARIAN:
        await this.prisma.client.veterinarian.update({
          where: { userId },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            workingDays,
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
            workingDays,
          },
        });
        break;

      default:
        throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    return successResponse(null, 'Operating schedule updated');
  }

  private parseWorkingDaysStrict(input: string | string[]): WorkingDay[] {
    const MAP: Record<string, WorkingDay> = {
      monday: WorkingDay.MONDAY,
      tuesday: WorkingDay.TUESDAY,
      wednesday: WorkingDay.WEDNESDAY,
      thursday: WorkingDay.THURSDAY,
      friday: WorkingDay.FRIDAY,
      saturday: WorkingDay.SATURDAY,
      sunday: WorkingDay.SUNDAY,
    };

    const values = Array.isArray(input) ? input : input.split(',');

    const result: WorkingDay[] = [];
    const invalid: string[] = [];

    for (const value of values) {
      const key = value?.trim().toLowerCase();
      if (!key) continue;

      const mapped = MAP[key];
      if (!mapped) {
        invalid.push(value);
        continue;
      }

      if (!result.includes(mapped)) {
        result.push(mapped);
      }
    }

    if (!result.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'At least one valid working day is required',
      );
    }

    if (invalid.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Invalid working days: ${invalid.join(', ')}`,
      );
    }

    return result;
  }

  private formatWorkingDaysForResponse(days?: WorkingDay[] | null): string {
    if (!days?.length) return '';

    return days
      .map((day) => day.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
      .join(',');
  }
}
