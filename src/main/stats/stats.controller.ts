import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateDriver,
  ValidateManager,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GraphFilterDto } from './dto/graph-filter.dto';
import { AdminGraphStatsService } from './services/admin-graph-stats.service';
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
    private readonly adminGraphStatsService: AdminGraphStatsService,
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

  @ApiOperation({ summary: 'Get admin transport graph stats' })
  @Get('admin/stats/graph')
  @ValidateAdmin()
  async getAdminGraphStats(@Query() filterDto: GraphFilterDto) {
    return this.adminGraphStatsService.getTransportGraph(filterDto);
  }

  @ApiOperation({ summary: 'Get shelter stats' })
  @Get('shelter/stats')
  @ValidateManager()
  async getShelterStats(@GetUser('sub') userId: string) {
    return this.shelterStatsService.getShelterStats(userId);
  }
}
