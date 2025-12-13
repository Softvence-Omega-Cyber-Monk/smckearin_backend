import {
  ValidateAdmin,
  ValidateAuth,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetApprovedDrivers } from '../dto/get-drivers.dto';
import { GetDriverService } from '../services/get-driver.service';

@ApiTags('Driver')
@ApiBearerAuth()
@ValidateAuth()
@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: GetDriverService) {}

  @ApiOperation({ summary: 'Get all drivers (admin only)' })
  @ValidateAdmin()
  @Get('driver')
  async getDriver(@Query() body: GetApprovedDrivers) {
    return this.driverService.getAllDrivers(body);
  }

  @ApiOperation({ summary: 'Get all approved drivers (shelter only)' })
  @Get('driver/approved')
  @ValidateManager()
  async getApprovedDrivers(@Query() body: GetApprovedDrivers) {
    return this.driverService.getApprovedDrivers(body);
  }

  @ApiOperation({ summary: 'Get single driver by driver id' })
  @Get('driver/:driverId')
  async getSingleDriver(@Param('driverId') driverId: string) {
    return this.driverService.getSingleDriver(driverId);
  }
}
