import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import {
  ValidateAdmin,
  ValidateAuth,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetApprovedDrivers } from '../dto/get-drivers.dto';
import { GetDriverService } from '../services/get-driver.service';
import { ManageDriverService } from '../services/manage-driver.service';

@ApiTags('Driver')
@ApiBearerAuth()
@ValidateAuth()
@Controller('driver')
export class DriverController {
  constructor(
    private readonly driverService: GetDriverService,
    private readonly manageDriverService: ManageDriverService,
  ) {}

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

  @ApiOperation({ summary: 'Approve or reject driver (admin only)' })
  @ValidateAdmin()
  @Get('driver/:driverId/approve')
  async approveOrRejectDriver(
    @Param('driverId') driverId: string,
    @Query() dto: ApproveOrRejectDto,
  ) {
    return this.manageDriverService.approveOrRejectDriver(driverId, dto);
  }

  @ApiOperation({ summary: 'Delete driver and user (admin only)' })
  @ValidateAdmin()
  @Get('driver/:driverId/delete')
  async deleteDriver(@Param('driverId') driverId: string) {
    return this.manageDriverService.deleteDriver(driverId);
  }
}
