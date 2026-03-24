import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetApprovedFosters, GetFostersDto } from '../dto/get-fosters.dto';
import { GetFosterService } from '../services/get-foster.service';
import { ManageFosterService } from '../services/manage-foster.service';

@ApiTags('Foster')
@ApiBearerAuth()
@ValidateAuth()
@Controller('foster')
export class FosterController {
  constructor(
    private readonly fosterService: GetFosterService,
    private readonly manageFosterService: ManageFosterService,
  ) {}

  @ApiOperation({ summary: 'Get all fosters (admin only)' })
  @ValidateAdmin()
  @Get('foster')
  async getFosters(@Query() body: GetFostersDto) {
    return this.fosterService.getAllFosters(body);
  }

  @ApiOperation({ summary: 'Get all approved fosters' })
  @Get('foster/approved')
  async getApprovedFosters(@Query() body: GetApprovedFosters) {
    return this.fosterService.getApprovedFosters(body);
  }

  @ApiOperation({ summary: 'Get single foster by id' })
  @Get('foster/:fosterId')
  async getSingleFoster(@Param('fosterId') fosterId: string) {
    return this.fosterService.getSingleFoster(fosterId);
  }

  @ApiOperation({ summary: 'Approve or reject foster (admin only)' })
  @ValidateAdmin()
  @Get('foster/:fosterId/approve')
  async approveOrRejectFoster(
    @Param('fosterId') fosterId: string,
    @Query() dto: ApproveOrRejectDto,
  ) {
    return this.manageFosterService.approveOrRejectFoster(fosterId, dto);
  }

  @ApiOperation({ summary: 'Delete foster and user (admin only)' })
  @ValidateAdmin()
  @Delete('foster/:fosterId/delete')
  async deleteFoster(@Param('fosterId') fosterId: string) {
    return this.manageFosterService.deleteFoster(fosterId);
  }
}
