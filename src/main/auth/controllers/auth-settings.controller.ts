import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpdateDailySchedulesDto,
  UpdateOperatingScheduleDto,
} from '../dto/setting.dto';
import { AuthSettingService } from '../services/auth-setting.service';

@ApiTags('Auth, Settings')
@Controller('auth')
export class AuthSettingsController {
  constructor(private readonly authSettingService: AuthSettingService) {}

  // ─── Existing: Global Operating Schedule ──────────────────────────────────

  @ApiOperation({ summary: 'Get Operating Schedule' })
  @ApiBearerAuth()
  @Get('operating-schedule')
  @ValidateAuth()
  async getOperatingSchedule(@GetUser() authUser: JWTPayload) {
    return this.authSettingService.getOperatingSchedule(authUser);
  }

  @ApiOperation({ summary: 'Update Operating Schedule' })
  @ApiBearerAuth()
  @Patch('operating-schedule')
  @ValidateAuth()
  async updateOperatingSchedule(
    @GetUser() authUser: JWTPayload,
    @Body() dto: UpdateOperatingScheduleDto,
  ) {
    return this.authSettingService.updateOperatingSchedule(authUser, dto);
  }

  // ─── New: Per-Day Schedules ────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Get Daily Schedules',
    description:
      'Returns per-day start/end times. Each day can have its own operating hours.',
  })
  @ApiBearerAuth()
  @Get('daily-schedules')
  @ValidateAuth()
  async getDailySchedules(@GetUser() authUser: JWTPayload) {
    return this.authSettingService.getDailySchedules(authUser);
  }

  @ApiOperation({
    summary: 'Update Daily Schedules',
    description:
      'Set per-day start/end times. Replaces all existing daily schedules. ' +
      'Each day in the array must be unique.',
  })
  @ApiBearerAuth()
  @Patch('daily-schedules')
  @ValidateAuth()
  async updateDailySchedules(
    @GetUser() authUser: JWTPayload,
    @Body() dto: UpdateDailySchedulesDto,
  ) {
    return this.authSettingService.updateDailySchedules(authUser, dto);
  }
}
