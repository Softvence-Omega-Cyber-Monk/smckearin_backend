import { ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetApprovedDrivers } from '../dto/get-drivers.dto';
import { GetDriverService } from '../services/get-driver.service';

@ApiTags('Driver')
@ApiBearerAuth()
@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: GetDriverService) {}

  @ApiOperation({ summary: 'Get all drivers' })
  @ValidateAdmin()
  @Get('driver')
  async getDriver(@Query() body: GetApprovedDrivers) {
    return this.driverService.getAllDrivers(body);
  }
}
