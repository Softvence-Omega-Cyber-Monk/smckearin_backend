import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateDriver,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTransportDto } from '../dto/create-transport.dto';
import {
  GetAllTransportHistory,
  GetTransportByLocationDto,
  GetTransportDto,
} from '../dto/get-transport.dto';
import { CreateTransportService } from '../services/create-transport.service';
import { GetDriverTransportService } from '../services/get-driver-transport.service';
import { GetSingleTransportService } from '../services/get-single-transport.service';
import { GetTransportService } from '../services/get-transport.service';

@ApiTags('Transport')
@ApiBearerAuth()
@ValidateAuth()
@Controller('transport')
export class TransportController {
  constructor(
    private readonly createTransportService: CreateTransportService,
    private readonly transportService: GetTransportService,
    private readonly getSingleTransportService: GetSingleTransportService,
    private readonly getDriverTransportService: GetDriverTransportService,
  ) {}

  @ApiOperation({ summary: 'Create transport' })
  @ValidateManager()
  @Post()
  async createTransport(
    @GetUser('sub') userId: string,
    @Body() dto: CreateTransportDto,
  ) {
    return this.createTransportService.createTransport(userId, dto);
  }

  @ApiOperation({ summary: 'Get own shelter transports' })
  @ValidateManager()
  @Get()
  async getTransports(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportDto,
  ) {
    return this.transportService.getTransports(userId, dto);
  }

  @ApiOperation({ summary: 'Get all transports (admin)' })
  @ValidateAdmin()
  @Get('all')
  async getAllTransports(@Query() dto: GetTransportDto) {
    return this.transportService.getAllTransports(dto);
  }

  @ApiOperation({ summary: 'Get single transport' })
  @ValidateAuth()
  @Get(':id')
  async getSingleTransport(@Param('id') transportId: string) {
    return this.getSingleTransportService.getSingleTransport(transportId);
  }

  @ApiOperation({ summary: 'Get all active transport by location' })
  @ValidateDriver()
  @Get('driver/location')
  async getAllActiveTransportByLocation(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportByLocationDto,
  ) {
    return this.getDriverTransportService.getUnAssignedOrSelfAssignedTransport(
      userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get active transport of driver' })
  @ValidateDriver()
  @Get('driver/active')
  async getActiveTransportOfDriver(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportDto,
  ) {
    return this.getDriverTransportService.getActiveTransportOfDriver(
      userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get all transport history of driver' })
  @ValidateDriver()
  @Get('driver/history')
  async getAllDriverTransportHistory(
    @GetUser('sub') userId: string,
    @Query() dto: GetAllTransportHistory,
  ) {
    return this.getDriverTransportService.getAllDriverTransportHistory(
      userId,
      dto,
    );
  }
}
