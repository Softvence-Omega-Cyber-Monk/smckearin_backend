import {
  GetUser,
  ValidateAuth,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTransportDto } from '../dto/create-transport.dto';
import { GetTransportDto } from '../dto/get-transport.dto';
import { CreateTransportService } from '../services/create-transport.service';
import { GetTransportService } from '../services/get-transport.service';

@ApiTags('Transport')
@ApiBearerAuth()
@ValidateAuth()
@Controller('transport')
export class TransportController {
  constructor(
    private readonly createTransportService: CreateTransportService,
    private readonly transportService: GetTransportService,
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

  @ApiOperation({ summary: 'Get transports of a shelter' })
  @Get()
  async getTransports(
    @GetUser('sub') userId: string,
    @Query() dto: GetTransportDto,
  ) {
    return this.transportService.getTransports(userId, dto);
  }
}
