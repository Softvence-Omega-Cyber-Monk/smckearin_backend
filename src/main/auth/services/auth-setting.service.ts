import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole, WorkingDay } from '@prisma';
import {
  UpdateDailySchedulesDto,
  UpdateOperatingScheduleDto,
} from '../dto/setting.dto';

// Prisma select shape reused across entities
const DAILY_SCHEDULE_SELECT = {
  id: true,
  day: true,
  startTime: true,
  endTime: true,
} as const;

@Injectable()
export class AuthSettingService {
  constructor(private prisma: PrismaService) {}

  // ─── Existing: Global Operating Schedule ──────────────────────────────────

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

  // ─── New: Per-Day Schedules ────────────────────────────────────────────────

  @HandleError('Failed to get daily schedules')
  async getDailySchedules(authUser: JWTPayload) {
    const { sub: userId, role } = authUser;

    let schedules: {
      id: string;
      day: WorkingDay;
      startTime: string;
      endTime: string;
    }[] = [];

    switch (role) {
      case UserRole.DRIVER: {
        const driver = await this.prisma.client.driver.findUnique({
          where: { userId },
          select: { dailySchedules: { select: DAILY_SCHEDULE_SELECT } },
        });
        if (!driver)
          throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
        schedules = driver.dailySchedules;
        break;
      }

      case UserRole.VETERINARIAN: {
        const vet = await this.prisma.client.veterinarian.findUnique({
          where: { userId },
          select: { dailySchedules: { select: DAILY_SCHEDULE_SELECT } },
        });
        if (!vet)
          throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');
        schedules = vet.dailySchedules;
        break;
      }

      case UserRole.SHELTER_ADMIN:
      case UserRole.MANAGER: {
        const shelter = await this.prisma.client.shelter.findFirst({
          where: {
            OR: [
              { shelterAdmins: { some: { id: userId } } },
              { managers: { some: { id: userId } } },
            ],
          },
          select: { dailySchedules: { select: DAILY_SCHEDULE_SELECT } },
        });
        if (!shelter)
          throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
        schedules = shelter.dailySchedules;
        break;
      }

      default:
        throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    return successResponse(
      this.formatDailySchedulesForResponse(schedules),
      'Daily schedules found',
    );
  }

  @HandleError('Failed to update daily schedules')
  async updateDailySchedules(
    authUser: JWTPayload,
    dto: UpdateDailySchedulesDto,
  ) {
    const { sub: userId, role } = authUser;

    if (!userId) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'User not found');
    }

    // Reject duplicate days in the payload
    this.assertNoDuplicateDays(dto.schedules.map((s) => s.day));

    switch (role) {
      case UserRole.DRIVER: {
        const driver = await this.prisma.client.driver.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!driver)
          throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');

        await this.upsertDailySchedules('driver', driver.id, dto);
        break;
      }

      case UserRole.VETERINARIAN: {
        const vet = await this.prisma.client.veterinarian.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!vet)
          throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');

        await this.upsertDailySchedules('veterinarian', vet.id, dto);
        break;
      }

      case UserRole.SHELTER_ADMIN:
      case UserRole.MANAGER: {
        const shelter = await this.prisma.client.shelter.findFirst({
          where: {
            OR: [
              { shelterAdmins: { some: { id: userId } } },
              { managers: { some: { id: userId } } },
            ],
          },
          select: { id: true },
        });
        if (!shelter)
          throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');

        await this.upsertDailySchedules('shelter', shelter.id, dto);
        break;
      }

      default:
        throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    return successResponse(null, 'Daily schedules updated');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Upsert strategy: delete all existing daily schedules for this entity,
   * then create the new ones. This keeps the logic simple and avoids
   * complex merge/patch logic for a small dataset.
   */
  private async upsertDailySchedules(
    entityType: 'driver' | 'veterinarian' | 'shelter',
    entityId: string,
    dto: UpdateDailySchedulesDto,
  ) {
    const foreignKey = `${entityType}Id` as
      | 'driverId'
      | 'veterinarianId'
      | 'shelterId';

    await this.prisma.client.$transaction([
      this.prisma.client.dailySchedule.deleteMany({
        where: { [foreignKey]: entityId },
      }),
      this.prisma.client.dailySchedule.createMany({
        data: dto.schedules.map((s) => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          [foreignKey]: entityId,
        })),
      }),
    ]);
  }

  private assertNoDuplicateDays(days: WorkingDay[]) {
    const seen = new Set<WorkingDay>();
    const duplicates: WorkingDay[] = [];

    for (const day of days) {
      if (seen.has(day)) duplicates.push(day);
      else seen.add(day);
    }

    if (duplicates.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Duplicate days are not allowed: ${duplicates.join(', ')}`,
      );
    }
  }

  private formatDailySchedulesForResponse(
    schedules: {
      id: string;
      day: WorkingDay;
      startTime: string;
      endTime: string;
    }[],
  ) {
    // Sort by canonical day order for consistent response
    const ORDER: WorkingDay[] = [
      WorkingDay.MONDAY,
      WorkingDay.TUESDAY,
      WorkingDay.WEDNESDAY,
      WorkingDay.THURSDAY,
      WorkingDay.FRIDAY,
      WorkingDay.SATURDAY,
      WorkingDay.SUNDAY,
    ];

    return [...schedules]
      .sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))
      .map((s) => ({
        id: s.id,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
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
