import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  GetUser,
  ValidateAdopter,
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
  GetAvailableAdoptionsDto,
  GetAvailableAnimalsDto,
  GetMyRequestsDto,
  GetShelterAdoptionsDto,
  SubmitAdoptionRequestDto,
} from '../dto/adoption-filter.dto';
import { CreateAdoptionDto } from '../dto/create-adoption.dto';
import { AdopterService } from '../services/adopter.service';

@ApiTags('Adopter/Adoption')
@Controller('adopter')
@ApiBearerAuth()
export class AdopterController {
  constructor(private readonly adopterService: AdopterService) {}

  // --- Shelter Panel ---

  @Post('')
  @ValidateManager()
  @ApiOperation({ summary: 'Create new adoption record(s) (Shelter only)' })
  async createAdoption(
    @GetUser('sub') userId: string,
    @Body() dto: CreateAdoptionDto,
  ) {
    return this.adopterService.createAdoption(userId, dto);
  }

  @Get('shelter/adoptions')
  @ValidateManager()
  @ApiOperation({ summary: 'Get all shelter adoptions with filters' })
  async getShelterAdoptions(
    @GetUser('sub') userId: string,
    @Query() dto: GetShelterAdoptionsDto,
  ) {
    return this.adopterService.getShelterAdoptions(userId, dto);
  }

  @Get('shelter/available/animal/adoptions')
  @ValidateManager()
  @ApiOperation({
    summary: 'Get animals available for creating new adoption records',
  })
  async getShelterAvailableAnimals(
    @GetUser('sub') userId: string,
    @Query() dto: GetAvailableAnimalsDto,
  ) {
    return this.adopterService.getShelterAvailableAnimals(userId, dto);
  }

  @Get('shelter/adoptions/:id')
  @ValidateManager()
  @ApiOperation({ summary: 'Get single adoption details' })
  async getAdoptionDetails(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.adopterService.getAdoptionDetails(userId, id);
  }

  @Patch('shelter/request/:id/approve')
  @ValidateManager()
  @ApiOperation({ summary: 'Approve an adoption request' })
  async approveAdoptionRequest(
    @GetUser('sub') userId: string,
    @Param('id') requestId: string,
  ) {
    return this.adopterService.approveAdoptionRequest(userId, requestId);
  }

  @Patch('shelter/request/:id/reject')
  @ValidateManager()
  @ApiOperation({ summary: 'Reject an adoption request' })
  async rejectAdoptionRequest(
    @GetUser('sub') userId: string,
    @Param('id') requestId: string,
  ) {
    return this.adopterService.rejectAdoptionRequest(userId, requestId);
  }

  @Delete('shelter/adoptions/:id')
  @ValidateManager()
  @ApiOperation({ summary: 'Delete an adoption record' })
  async deleteAdoption(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.adopterService.deleteAdoption(userId, id);
  }

  // --- Adopter Panel ---

  @Get('available')
  @ApiOperation({ summary: 'Get all available adoptions with filters' })
  async getAvailableAdoptions(@Query() dto: GetAvailableAdoptionsDto) {
    return this.adopterService.getAvailableAdoptions(dto);
  }

  @Get('available/:id')
  @ApiOperation({ summary: 'Get details of an available animal' })
  async getAvailableAdoptionDetails(@Param('id') id: string) {
    return this.adopterService.getAvailableAdoptionDetails(id);
  }

  @Post('request')
  @ValidateAdopter()
  @ApiOperation({ summary: 'Submit an adoption request' })
  async submitAdoptionRequest(
    @GetUser('sub') userId: string,
    @Body() dto: SubmitAdoptionRequestDto,
  ) {
    return this.adopterService.submitAdoptionRequest(userId, dto);
  }

  @Get('my-requests')
  @ValidateAdopter()
  @ApiOperation({ summary: 'Get all adoption requests submitted by me' })
  async getMyRequests(
    @GetUser('sub') userId: string,
    @Query() dto: GetMyRequestsDto,
  ) {
    return this.adopterService.getMyRequests(userId, dto);
  }

  @Get('requests/count')
  @ValidateAdopter()
  @ApiOperation({
    summary: 'Get total count of adoption requests submitted by me',
  })
  async getRequestsCount(@GetUser('sub') userId: string) {
    return this.adopterService.getRequestsCount(userId);
  }

  @Get('adoptions/request/:id')
  @ValidateAdopter()
  @ApiOperation({
    summary: 'Get single adoption request details for adopter',
  })
  async getAdoptionDetailsForAdopter(@Param('id') id: string) {
    return this.adopterService.getAdoptionDetailsForAdopter(id);
  }

  @Get('adoptions/count')
  @ValidateAdopter()
  @ApiOperation({
    summary: 'Get total count of successful adoptions by me',
  })
  async getAdoptionsCount(@GetUser('sub') userId: string) {
    return this.adopterService.getAdoptionsCount(userId);
  }
}
