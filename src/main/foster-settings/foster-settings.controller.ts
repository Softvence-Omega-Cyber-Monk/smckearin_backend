import { UserEnum } from '@/common/enum/user.enum';
import { GetUser, Roles } from '@/core/jwt/jwt.decorator';
import { JwtAuthGuard, RolesGuard } from '@/core/jwt/jwt.guard';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateFosterPreferencesDto } from './dto/update-foster-preferences.dto';
import { UpdateOperatingScheduleDto } from './dto/operating-schedule.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { FosterSettingsService } from './foster-settings.service';

@ApiTags('Foster Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserEnum.FOSTER, UserEnum.FOSTER_ADMIN)
@Controller('foster-settings')
export class FosterSettingsController {
  constructor(private readonly fosterSettingsService: FosterSettingsService) {}

  @ApiOperation({ summary: 'Get foster preferences' })
  @Get('preferences')
  async getFosterPreferences(@GetUser('sub') userId: string) {
    return this.fosterSettingsService.getFosterPreferences(userId);
  }

  @ApiOperation({ summary: 'Update foster preferences' })
  @Put('preferences')
  async updateFosterPreferences(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateFosterPreferencesDto,
  ) {
    return this.fosterSettingsService.updateFosterPreferences(userId, dto);
  }

  @ApiOperation({ summary: 'Get foster operating schedule' })
  @Get('schedule')
  async getOperatingSchedule(@GetUser('sub') userId: string) {
    return this.fosterSettingsService.getOperatingSchedule(userId);
  }

  @ApiOperation({ summary: 'Update foster operating schedule' })
  @Put('schedule')
  async updateOperatingSchedule(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateOperatingScheduleDto,
  ) {
    return this.fosterSettingsService.updateOperatingSchedule(
      userId,
      dto.schedule,
    );
  }

  @ApiOperation({ summary: 'Get foster notification settings' })
  @Get('notifications')
  async getSettings(@GetUser('sub') userId: string) {
    return this.fosterSettingsService.getSettings(userId);
  }

  @ApiOperation({ summary: 'Update foster notification settings' })
  @Put('notifications')
  async updateSettings(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.fosterSettingsService.updateSettings(userId, dto);
  }
}
