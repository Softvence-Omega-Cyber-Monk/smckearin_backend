import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateDriver,
  ValidateManager,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStatsService } from './services/admin-stats.service';
import { DriverStatsService } from './services/driver-stats.service';
import { ShelterStatsService } from './services/shelter-stats.service';
import { VetStatsService } from './services/vet-stats.service';

@ApiTags('Stats & Analytics')
@ValidateAuth()
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(
    private readonly driverStatsService: DriverStatsService,
    private readonly vetStatsService: VetStatsService,
    private readonly adminStatsService: AdminStatsService,
    private readonly shelterStatsService: ShelterStatsService,
  ) {}

  @ApiOperation({ summary: 'Get driver stats' })
  @Get('driver/stats')
  @ValidateDriver()
  async getDriverStats(@GetUser('sub') userId: string) {
    return this.driverStatsService.getDriverStats(userId);
  }

  @ApiOperation({ summary: 'Get vet stats' })
  @Get('vet/stats')
  @ValidateVeterinarian()
  async getVetStats(@GetUser('sub') userId: string) {
    return this.vetStatsService.getVetStats(userId);
  }

  @ApiOperation({ summary: 'Get admin stats' })
  @Get('admin/stats')
  @ValidateAdmin()
  async getAdminStats(@GetUser('sub') userId: string) {
    return this.adminStatsService.getAdminStats(userId);
  }

  @ApiOperation({ summary: 'Get shelter stats' })
  @Get('shelter/stats')
  @ValidateManager()
  async getShelterStats(@GetUser('sub') userId: string) {
    return this.shelterStatsService.getShelterStats(userId);
  }
}
