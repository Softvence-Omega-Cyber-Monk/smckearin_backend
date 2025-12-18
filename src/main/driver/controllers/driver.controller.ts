import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateDriver,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  DocumentApproveDto,
  DriverDocumentDeleteDto,
  UploadDocumentDto,
} from '../dto/driver.dto';
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
  @Delete('driver/:driverId/delete')
  async deleteDriver(@Param('driverId') driverId: string) {
    return this.manageDriverService.deleteDriver(driverId);
  }

  @ApiOperation({ summary: 'Delete driver document' })
  @ValidateDriver()
  @Delete('driver/:driverId/document/:type')
  async deleteDriverDocument(
    @Param('driverId') driverId: string,
    @Param() dto: DriverDocumentDeleteDto,
    @GetUser() authUser: JWTPayload,
  ) {
    return this.manageDriverService.deleteDriverDocument(
      driverId,
      authUser,
      dto,
    );
  }

  @ApiOperation({ summary: 'Driver upload own document' })
  @ValidateDriver()
  @ApiConsumes('multipart/form-data')
  @Post('driver/me/document/:type')
  @UseInterceptors(FileInterceptor('document'))
  async uploadMyDriverDocument(
    @GetUser('sub') userId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'File is required');
    }

    dto.document = file;

    return this.manageDriverService.uploadDriverDocument(userId, dto);
  }

  @ApiOperation({ summary: 'Approve or reject driver document (admin only)' })
  @ValidateAdmin()
  @Patch('driver/:driverId/document/approve')
  async approveOrRejectDriverDocument(
    @Param('driverId') driverId: string,
    @Body() dto: DocumentApproveDto,
  ) {
    return this.manageDriverService.approveOrRejectDriverDocument(
      driverId,
      dto,
    );
  }
}
