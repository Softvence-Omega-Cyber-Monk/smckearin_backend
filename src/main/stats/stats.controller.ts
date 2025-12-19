import {
  GetUser,
  ValidateAuth,
  ValidateDriver,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DriverStatsService } from './services/driver-stats.service';

@ApiTags('Stats & Analytics')
@ValidateAuth()
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly adminStatsService: DriverStatsService) {}

  @ApiOperation({ summary: 'Get driver stats' })
  @Get('driver/stats')
  @ValidateDriver()
  async getDriverStats(@GetUser('sub') userId: string) {
    return this.adminStatsService.getDriverStats(userId);
  }
}
