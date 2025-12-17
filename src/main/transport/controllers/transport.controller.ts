import {
  GetUser,
  ValidateAuth,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTransportDto } from '../dto/create-transport.dto';
import { CreateTransportService } from '../services/create-transport.service';

@ApiTags('Transport')
@ApiBearerAuth()
@ValidateAuth()
@Controller('transport')
export class TransportController {
  constructor(
    private readonly createTransportService: CreateTransportService,
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
}
