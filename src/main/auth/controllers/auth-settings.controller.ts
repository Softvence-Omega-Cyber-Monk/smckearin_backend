import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateOperatingScheduleDto } from '../dto/setting.dto';
import { AuthSettingService } from '../services/auth-setting.service';

@ApiTags('Auth, Settings')
@Controller('auth')
export class AuthSettingsController {
  constructor(private readonly authSettingService: AuthSettingService) {}

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
}
