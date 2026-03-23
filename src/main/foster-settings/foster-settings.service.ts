import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateFosterPreferencesDto } from './dto/update-foster-preferences.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

type ScheduleEntry = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

@Injectable()
export class FosterSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get foster settings')
  async getSettings(userId: string) {
    const settingsDelegate = (this.prisma.client as any).userSettings;
    if (!settingsDelegate) {
      throw new AppError(500, 'User settings model is not available');
    }

    const settings = await settingsDelegate.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return successResponse(settings, 'Settings fetched successfully');
  }

  @HandleError('Failed to update foster settings')
  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const settingsDelegate = (this.prisma.client as any).userSettings;
    if (!settingsDelegate) {
      throw new AppError(500, 'User settings model is not available');
    }

    const settings = await settingsDelegate.upsert({
      where: { userId },
      update: dto,
      create: {
        userId,
        ...dto,
      },
    });

    return successResponse(settings, 'Settings updated successfully');
  }

  @HandleError('Failed to get foster preferences')
  async getFosterPreferences(userId: string) {
    const user = await (this.prisma.client as any).user.findUnique({
      where: { id: userId },
      include: {
        fosterProfile: true,
        fosterPreference: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return successResponse(
      {
        fosterProfile: user.fosterProfile,
        fosterPreference: user.fosterPreference,
      },
      'Foster preferences fetched successfully',
    );
  }

  @HandleError('Failed to update foster preferences')
  async updateFosterPreferences(
    userId: string,
    dto: UpdateFosterPreferencesDto,
  ) {
    const fosterProfileDelegate = (this.prisma.client as any).fosterProfile;
    const fosterPreferenceDelegate = (this.prisma.client as any)
      .fosterPreference;

    if (!fosterProfileDelegate || !fosterPreferenceDelegate) {
      throw new AppError(500, 'Foster preference models are not available');
    }

    await fosterProfileDelegate.upsert({
      where: { userId },
      update: {
        maxAnimalsAtOnce: dto.maxAnimalsAtOnce,
        availabilityNotes: dto.availabilityNotes,
      },
      create: {
        userId,
        maxAnimalsAtOnce: dto.maxAnimalsAtOnce,
        availabilityNotes: dto.availabilityNotes,
      },
    });

    const preferences = await fosterPreferenceDelegate.upsert({
      where: { userId },
      update: {
        animalTypes: dto.animalTypes,
        sizePreference: dto.sizePreference,
        maxAnimalsAtOnce: dto.maxAnimalsAtOnce,
        availabilityNotes: dto.availabilityNotes,
        locationAddress: dto.locationAddress,
        locationLat: dto.locationLat,
        locationLng: dto.locationLng,
        radiusType: dto.radiusType,
        customRadiusMiles: dto.customRadiusMiles,
      },
      create: {
        userId,
        animalTypes: dto.animalTypes,
        sizePreference: dto.sizePreference,
        maxAnimalsAtOnce: dto.maxAnimalsAtOnce,
        availabilityNotes: dto.availabilityNotes,
        locationAddress: dto.locationAddress,
        locationLat: dto.locationLat,
        locationLng: dto.locationLng,
        radiusType: dto.radiusType,
        customRadiusMiles: dto.customRadiusMiles,
      },
    });

    return successResponse(
      preferences,
      'Foster preferences updated successfully',
    );
  }

  @HandleError('Failed to get foster operating schedule')
  async getOperatingSchedule(userId: string) {
    const operatingScheduleDelegate = (this.prisma.client as any)
      .operatingSchedule;
    if (!operatingScheduleDelegate) {
      throw new AppError(500, 'Operating schedule model is not available');
    }

    const schedule = await operatingScheduleDelegate.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (!schedule.length) {
      return successResponse(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isOpen: false,
          openTime: null,
          closeTime: null,
        })),
        'Operating schedule fetched successfully',
      );
    }

    return successResponse(schedule, 'Operating schedule fetched successfully');
  }

  @HandleError('Failed to update foster operating schedule')
  async updateOperatingSchedule(userId: string, schedule: ScheduleEntry[]) {
    const operatingScheduleDelegate = (this.prisma.client as any)
      .operatingSchedule;
    const fosterProfileDelegate = (this.prisma.client as any).fosterProfile;

    if (!operatingScheduleDelegate || !fosterProfileDelegate) {
      throw new AppError(500, 'Operating schedule models are not available');
    }

    const seen = new Set<number>();
    for (const entry of schedule) {
      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be between 0 and 6');
      }
      if (seen.has(entry.dayOfWeek)) {
        throw new BadRequestException(
          'Duplicate dayOfWeek values are not allowed',
        );
      }
      seen.add(entry.dayOfWeek);
    }

    for (const entry of schedule) {
      await operatingScheduleDelegate.upsert({
        where: {
          userId_dayOfWeek: {
            userId,
            dayOfWeek: entry.dayOfWeek,
          },
        },
        update: {
          isOpen: entry.isOpen,
          openTime: entry.openTime ?? null,
          closeTime: entry.closeTime ?? null,
        },
        create: {
          userId,
          dayOfWeek: entry.dayOfWeek,
          isOpen: entry.isOpen,
          openTime: entry.openTime ?? null,
          closeTime: entry.closeTime ?? null,
        },
      });
    }

    const savedSchedule = await operatingScheduleDelegate.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });

    const weeklyHoursOpen = this.calculateWeeklyHoursOpen(savedSchedule);

    await fosterProfileDelegate.upsert({
      where: { userId },
      update: { weeklyHoursOpen },
      create: { userId, weeklyHoursOpen },
    });

    return successResponse(
      {
        schedule: savedSchedule,
        weeklyHoursOpen,
      },
      'Operating schedule updated successfully',
    );
  }

  private calculateWeeklyHoursOpen(schedule: ScheduleEntry[]) {
    return Math.round(
      schedule.reduce((total, entry) => {
        if (!entry.isOpen) {
          return total;
        }

        if (!entry.openTime || !entry.closeTime) {
          return total + 8;
        }

        const [openHour, openMinute] = entry.openTime.split(':').map(Number);
        const [closeHour, closeMinute] = entry.closeTime
          .split(':')
          .map(Number);
        const openValue = openHour * 60 + openMinute;
        const closeValue = closeHour * 60 + closeMinute;

        if (closeValue <= openValue) {
          return total + 8;
        }

        return total + (closeValue - openValue) / 60;
      }, 0),
    );
  }
}
