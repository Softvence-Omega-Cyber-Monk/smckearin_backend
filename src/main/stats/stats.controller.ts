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
import { ShelterGraphStatsService } from './services/shelter-graph-stats.service';
import { ShelterStatsService } from './services/shelter-stats.service';
import { VetGraphStatsService } from './services/vet-graph-stats.service';
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
    private readonly vetGraphStatsService: VetGraphStatsService,
    private readonly shelterGraphStatsService: ShelterGraphStatsService,
  ) {}

  @ApiOperation({ summary: 'Get driver stats (driver)' })
  @Get('driver/stats')
  @ValidateDriver()
  async getDriverStats(@GetUser('sub') userId: string) {
    return this.driverStatsService.getDriverStats(userId);
  }

  @ApiOperation({ summary: 'Get vet stats (vet)' })
  @Get('vet/stats')
  @ValidateVeterinarian()
  async getVetStats(@GetUser('sub') userId: string) {
    return this.vetStatsService.getVetStats(userId);
  }

  @ApiOperation({ summary: 'Get vet pie chart stats (vet)' })
  @Get('vet/stats/chart')
  @ValidateVeterinarian()
  async getCertificationOverview(@GetUser('sub') userId: string) {
    return this.vetGraphStatsService.getCertificationOverview(userId);
  }

  @ApiOperation({ summary: 'Get vet certification stats (vet)' })
  @Get('vet/stats/certification')
  @ValidateVeterinarian()
  async getCertificationStats(@GetUser('sub') userId: string) {
    return this.vetGraphStatsService.getCertificationStats(userId);
  }

  @ApiOperation({ summary: 'Get admin stats (admin)' })
  @Get('admin/stats')
  @ValidateAdmin()
  async getAdminStats(@GetUser('sub') userId: string) {
    return this.adminStatsService.getAdminStats(userId);
  }

  @ApiOperation({ summary: 'Get admin transport graph stats (admin)' })
  @Get('admin/stats/graph')
  @ValidateAdmin()
  async getAdminGraphStats(@Query() filterDto: GraphFilterDto) {
    return this.adminGraphStatsService.getTransportGraph(filterDto);
  }

  @ApiOperation({ summary: 'Get admin operational overview stats (admin)' })
  @Get('admin/stats/overview')
  @ValidateAdmin()
  async getOperationalOverview(@Query() filterDto: GraphFilterDto) {
    return this.adminGraphStatsService.getOperationalOverview(filterDto);
  }

  @ApiOperation({ summary: 'Get shelter stats (shelter)' })
  @Get('shelter/stats')
  @ValidateManager()
  async getShelterStats(@GetUser('sub') userId: string) {
    return this.shelterStatsService.getShelterStats(userId);
  }

  @ApiOperation({ summary: 'Get shelter trips overview stats (shelter)' })
  @Get('shelter/stats/chart')
  @ValidateManager()
  async getTripsOverview(@GetUser('sub') userId: string) {
    return this.shelterGraphStatsService.getTripsOverview(userId);
  }

  @ApiOperation({ summary: 'Get shelter trips stats (shelter)' })
  @Get('shelter/stats/trips')
  @ValidateManager()
  async getTripsStats(@GetUser('sub') userId: string) {
    return this.shelterGraphStatsService.getTripsStats(userId);
  }
}
