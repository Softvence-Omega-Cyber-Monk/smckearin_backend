import { Body, Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetApprovedDrivers } from '../dto/get-drivers.dto';
import { GetDriverService } from '../services/get-driver.service';

@ApiTags('Driver')
@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: GetDriverService) {}

  @ApiOperation({ summary: 'Get all drivers' })
  @Get('driver')
  async getDriver(@Body() body: GetApprovedDrivers) {
    return this.driverService.getAllDrivers(body);
  }
}
