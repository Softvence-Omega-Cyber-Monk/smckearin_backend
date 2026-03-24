import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateFoster,
  ValidateManager,
} from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateFosterAnimalInterestDto,
  GetFosterAnimalsDto,
  GetFosterRequestsDto,
  ReviewFosterInterestDto,
} from '../dto/foster-animal.dto';
import { GetApprovedFosters, GetFostersDto } from '../dto/get-fosters.dto';
import { FosterAnimalService } from '../services/foster-animal.service';
import { GetFosterService } from '../services/get-foster.service';
import { ManageFosterAnimalInterestService } from '../services/manage-foster-animal-interest.service';
import { ManageFosterService } from '../services/manage-foster.service';

@ApiTags('Foster')
@ApiBearerAuth()
@ValidateAuth()
@Controller('foster')
export class FosterController {
  constructor(
    private readonly fosterService: GetFosterService,
    private readonly manageFosterService: ManageFosterService,
    private readonly fosterAnimalService: FosterAnimalService,
    private readonly manageFosterAnimalInterestService: ManageFosterAnimalInterestService,
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
  @Patch('foster/:fosterId/approve')
  async approveOrRejectFoster(
    @Param('fosterId') fosterId: string,
    @Body() dto: ApproveOrRejectDto,
  ) {
    return this.manageFosterService.approveOrRejectFoster(fosterId, dto);
  }

  @ApiOperation({ summary: 'Delete foster and user (admin only)' })
  @ValidateAdmin()
  @Delete('foster/:fosterId/delete')
  async deleteFoster(@Param('fosterId') fosterId: string) {
    return this.manageFosterService.deleteFoster(fosterId);
  }

  @ApiOperation({ summary: 'Get foster home dashboard' })
  @ValidateFoster()
  @Get('me/dashboard')
  async getMyDashboard(@GetUser('sub') userId: string) {
    return this.fosterAnimalService.getDashboard(userId);
  }

  @ApiOperation({ summary: 'Get animals available for foster placement' })
  @ValidateFoster()
  @Get('me/animals')
  async getAvailableAnimals(
    @GetUser('sub') userId: string,
    @Query() dto: GetFosterAnimalsDto,
  ) {
    return this.fosterAnimalService.getAnimals(userId, dto);
  }

  @ApiOperation({ summary: 'Get single animal details for foster flow' })
  @ValidateFoster()
  @Get('me/animals/:animalId')
  async getAnimalDetails(
    @GetUser('sub') userId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.fosterAnimalService.getAnimalDetails(userId, animalId);
  }

  @ApiOperation({ summary: 'Express interest in fostering an animal' })
  @ValidateFoster()
  @Post('me/animals/:animalId/interest')
  async expressInterest(
    @GetUser('sub') userId: string,
    @Param('animalId') animalId: string,
    @Body() dto: CreateFosterAnimalInterestDto,
  ) {
    return this.manageFosterAnimalInterestService.expressInterest(
      userId,
      animalId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get current foster requests' })
  @ValidateFoster()
  @Get('me/requests')
  async getMyRequests(
    @GetUser('sub') userId: string,
    @Query() dto: GetFosterRequestsDto,
  ) {
    return this.fosterAnimalService.getMyRequests(userId, dto);
  }

  @ApiOperation({
    summary: 'Approve or reject a foster interest request (shelter only)',
  })
  @ValidateManager()
  @Patch('interest/:interestId/review')
  async reviewFosterInterest(
    @GetUser('sub') userId: string,
    @Param('interestId') interestId: string,
    @Body() dto: ReviewFosterInterestDto,
  ) {
    return this.manageFosterAnimalInterestService.reviewInterest(
      userId,
      interestId,
      dto,
    );
  }
}
