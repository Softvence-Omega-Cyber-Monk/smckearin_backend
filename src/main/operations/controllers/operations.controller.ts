import {
  GetUser,
  ValidateAuth,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetOperationEventsDto } from '../dto/get-operation-events.dto';
import { OperationsService } from '../services/operations.service';

@ApiTags('Operations')
@ApiBearerAuth()
@ValidateAuth()
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @ApiOperation({ summary: 'Get structured operation events (manager/admin)' })
  @ValidateManager()
  @Get('events')
  async getOperationEvents(
    @GetUser() authUser: JWTPayload,
    @Query() dto: GetOperationEventsDto,
  ) {
    return this.operationsService.getOperationEvents(authUser, dto);
  }

  @ApiOperation({ summary: 'Get operation event details by id' })
  @ValidateManager()
  @Get('events/:id')
  async getOperationEventById(
    @GetUser() authUser: JWTPayload,
    @Param('id') id: string,
  ) {
    return this.operationsService.getOperationEventById(authUser, id);
  }
}
