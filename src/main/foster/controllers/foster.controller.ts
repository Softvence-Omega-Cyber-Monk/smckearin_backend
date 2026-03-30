import { PaginationDto } from '@/common/dto/pagination.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateFoster,
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
  ConfirmReceiptDto,
  CreateFosterAnimalInterestDto,
  GetFosterAnimalsDto,
  GetFosterRequestsDto,
  ReviewFosterInterestDto,
} from '../dto/foster-animal.dto';
import {
  CancelShelterFosterRequestDto,
  CreateFosterTransportDto,
  CreateShelterFosterRequestDto,
  GetShelterFosterRequestsDto,
  UpdateShelterFosterRequestDto,
} from '../dto/foster-request.dto';
import {
  FosterApproveDto,
  FosterDocumentApproveDto,
  UploadFosterDocumentDto,
} from '../dto/foster.dto';
import { GetApprovedFosters, GetFostersDto } from '../dto/get-fosters.dto';
import { FosterAnimalService } from '../services/foster-animal.service';
import { GetFosterService } from '../services/get-foster.service';
import { ManageFosterAnimalInterestService } from '../services/manage-foster-animal-interest.service';
import { ManageFosterService } from '../services/manage-foster.service';
import { ShelterFosterRequestService } from '../services/shelter-foster-request.service';

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
    private readonly shelterFosterRequestService: ShelterFosterRequestService,
  ) {}

  @ApiOperation({ summary: 'Get shelter foster requests (shelter only)' })
  @ValidateManager()
  @Get()
  async getShelterFosterRequests(
    @GetUser('sub') userId: string,
    @Query() dto: GetShelterFosterRequestsDto,
  ) {
    return this.shelterFosterRequestService.getShelterFosterRequests(
      userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get single foster by id' })
  @Get('foster/:fosterId')
  async getSingleFoster(@Param('fosterId') fosterId: string) {
    return this.fosterService.getSingleFoster(fosterId);
  }

  @ApiOperation({ summary: 'Get shelter foster request counts by status' })
  @ValidateManager()
  @Get('counts')
  async getShelterFosterRequestCounts(@GetUser('sub') userId: string) {
    return this.shelterFosterRequestService.getShelterFosterRequestCounts(
      userId,
    );
  }

  @ApiOperation({ summary: 'Get shelter foster placement statistics' })
  @ValidateManager()
  @Get('shelter/placement-stats')
  async getFosterPlacementStats(@GetUser('sub') userId: string) {
    return this.shelterFosterRequestService.getFosterPlacementStats(userId);
  }

  @ApiOperation({ summary: 'Get recently completed foster placements' })
  @ValidateManager()
  @Get('shelter/recently-completed')
  async getShelterRecentlyCompleted(@GetUser('sub') userId: string) {
    return this.shelterFosterRequestService.getShelterRecentlyCompletedPlacements(
      userId,
    );
  }

  @ApiOperation({ summary: 'Create shelter foster request (shelter only)' })
  @ValidateManager()
  @Post()
  async createShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Body() dto: CreateShelterFosterRequestDto,
  ) {
    return this.shelterFosterRequestService.createShelterFosterRequest(
      userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get all foster accounts (admin only)' })
  @ValidateAdmin()
  @Get('accounts')
  async getFosterAccounts(@Query() body: GetFostersDto) {
    return this.fosterService.getAllFosters(body);
  }

  @ApiOperation({ summary: 'Get all fosters (admin only, legacy route)' })
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

  @ApiOperation({ summary: 'Get shelter foster request details' })
  @ValidateManager()
  @Get(':fosterRequestId')
  async getShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
  ) {
    return this.shelterFosterRequestService.getShelterFosterRequest(
      userId,
      fosterRequestId,
    );
  }

  @ApiOperation({ summary: 'Update shelter foster request' })
  @ValidateManager()
  @Patch(':fosterRequestId')
  async updateShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
    @Body() dto: UpdateShelterFosterRequestDto,
  ) {
    return this.shelterFosterRequestService.updateShelterFosterRequest(
      userId,
      fosterRequestId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Cancel shelter foster request' })
  @ValidateManager()
  @Patch(':fosterRequestId/cancel')
  async cancelShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
    @Body() dto: CancelShelterFosterRequestDto,
  ) {
    return this.shelterFosterRequestService.cancelShelterFosterRequest(
      userId,
      fosterRequestId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Approve interested foster request' })
  @ValidateManager()
  @Patch(':fosterRequestId/approve')
  async approveShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
  ) {
    return this.shelterFosterRequestService.approveShelterFosterRequest(
      userId,
      fosterRequestId,
    );
  }

  @ApiOperation({ summary: 'Decline interested foster request' })
  @ValidateManager()
  @Patch(':fosterRequestId/decline')
  async declineShelterFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
  ) {
    return this.shelterFosterRequestService.declineShelterFosterRequest(
      userId,
      fosterRequestId,
    );
  }

  @ApiOperation({ summary: 'Create transport for foster request' })
  @ValidateManager()
  @Post(':fosterRequestId/transport')
  async createTransportForFosterRequest(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
    @Body() dto: CreateFosterTransportDto,
  ) {
    return this.shelterFosterRequestService.createTransportForFosterRequest(
      userId,
      fosterRequestId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Track foster transport' })
  @ValidateManager()
  @Get(':fosterRequestId/track')
  async getFosterTracking(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
  ) {
    return this.shelterFosterRequestService.getFosterTracking(
      userId,
      fosterRequestId,
    );
  }

  @ApiOperation({ summary: 'Get foster arrival proof' })
  @ValidateManager()
  @Get(':fosterRequestId/proof')
  async getArrivalProof(
    @GetUser('sub') userId: string,
    @Param('fosterRequestId') fosterRequestId: string,
  ) {
    return this.shelterFosterRequestService.getArrivalProof(
      userId,
      fosterRequestId,
    );
  }

  @ApiOperation({ summary: 'Approve or reject foster (admin only)' })
  @ValidateAdmin()
  @Patch('foster/:fosterId/approve')
  async approveOrRejectFoster(
    @Param('fosterId') fosterId: string,
    @Body() dto: FosterApproveDto,
  ) {
    return this.manageFosterService.approveOrRejectFoster(fosterId, dto);
  }

  @ApiOperation({ summary: 'Delete foster and user (admin only)' })
  @ValidateAdmin()
  @Delete('foster/:fosterId/delete')
  async deleteFoster(@Param('fosterId') fosterId: string) {
    return this.manageFosterService.deleteFoster(fosterId);
  }

  @ApiOperation({ summary: 'Get foster dashboard data' })
  @ValidateFoster()
  @Get('me/dashboard')
  async getDashboard(
    @GetUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.fosterAnimalService.getDashboard(userId, dto);
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

  @ApiOperation({ summary: 'Get single foster request details' })
  @ValidateFoster()
  @Get('me/requests/:requestId')
  async getMyRequestDetails(
    @GetUser('sub') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.fosterAnimalService.getRequestDetails(userId, requestId);
  }

  @ApiOperation({ summary: 'Cancel/Withdraw foster request' })
  @ValidateFoster()
  @Patch('me/requests/:requestId/cancel')
  async cancelMyRequest(
    @GetUser('sub') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.fosterAnimalService.cancelRequest(userId, requestId);
  }

  @ApiOperation({ summary: 'Foster confirm animal receipt' })
  @ValidateFoster()
  @ApiConsumes('multipart/form-data')
  @Post('me/requests/:requestId/confirm')
  @UseInterceptors(FileInterceptor('proof'))
  async confirmReceipt(
    @GetUser('sub') userId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ConfirmReceiptDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    dto.proof = file;
    return this.fosterAnimalService.confirmReceipt(userId, requestId, dto);
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

  @ApiOperation({ summary: 'Delete foster document' })
  @Delete('document/:documentId')
  async deleteFosterDocument(
    @Param('documentId') documentId: string,
    @GetUser() authUser: JWTPayload,
  ) {
    return this.manageFosterService.deleteFosterDocument(documentId, authUser);
  }

  @ApiOperation({ summary: 'Get own foster documents' })
  @ValidateFoster()
  @Get('me/document')
  async getOwnFosterDocuments(@GetUser('sub') userId: string) {
    return this.fosterService.getOwnFosterDocuments(userId);
  }

  @ApiOperation({ summary: 'Get single foster document' })
  @Get('document/:documentId')
  async getSingleFosterDocument(@Param('documentId') documentId: string) {
    return this.fosterService.getSingleFosterDocument(documentId);
  }

  @ApiOperation({ summary: 'Foster upload document' })
  @ValidateFoster()
  @ApiConsumes('multipart/form-data')
  @Post('me/document')
  @UseInterceptors(FileInterceptor('document'))
  async uploadMyFosterDocument(
    @GetUser('sub') userId: string,
    @Body() dto: UploadFosterDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'File is required');
    }

    dto.document = file;

    return this.manageFosterService.uploadFosterDocument(userId, dto);
  }

  @ApiOperation({ summary: 'Approve or reject foster document (admin only)' })
  @ValidateAdmin()
  @Patch('document/:documentId/approve')
  async approveOrRejectFosterDocument(
    @Param('documentId') documentId: string,
    @Body() dto: FosterDocumentApproveDto,
  ) {
    return this.manageFosterService.approveOrRejectFosterDocument(
      documentId,
      dto,
    );
  }
}
