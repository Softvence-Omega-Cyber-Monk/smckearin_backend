import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
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
import { GetApprovedShelters, GetSheltersDto } from '../dto/get-shelters.dto';
import {
  ShelterDocumentApproveDto,
  UploadShelterDocumentDto,
} from '../dto/shelter.dto';
import { GetShelterService } from '../services/get-shelter.service';
import { ManageShelterService } from '../services/manage-shelter.service';

@ApiTags('Shelter')
@ApiBearerAuth()
@ValidateAuth()
@Controller('shelter')
export class ShelterController {
  constructor(
    private readonly shelterService: GetShelterService,
    private readonly manageShelterService: ManageShelterService,
  ) {}

  @ApiOperation({ summary: 'Get all shelters (admin only)' })
  @ValidateAdmin()
  @Get('shelter')
  async getShelter(@Query() body: GetSheltersDto) {
    return this.shelterService.getAllShelters(body);
  }

  @ApiOperation({ summary: 'Get all approved shelters' })
  @Get('shelter/approved')
  async getApprovedShelters(@Query() body: GetApprovedShelters) {
    return this.shelterService.getApprovedShelters(body);
  }

  @ApiOperation({ summary: 'Get single shelter by id' })
  @Get('shelter/:shelterId')
  async getSingleShelter(@Param('shelterId') shelterId: string) {
    return this.shelterService.getSingleShelter(shelterId);
  }

  @ApiOperation({ summary: 'Approve or reject shelter (admin only)' })
  @ValidateAdmin()
  @Get('shelter/:shelterId/approve')
  async approveOrRejectShelter(
    @Param('shelterId') shelterId: string,
    @Query() dto: ApproveOrRejectDto,
  ) {
    return this.manageShelterService.approveOrRejectShelter(shelterId, dto);
  }

  @ApiOperation({ summary: 'Delete shelter (admin only)' })
  @ValidateAdmin()
  @Delete('shelter/:shelterId/delete')
  async deleteShelter(@Param('shelterId') shelterId: string) {
    return this.manageShelterService.deleteShelter(shelterId);
  }

  @ApiOperation({ summary: 'Delete shelter document' })
  @ValidateManager()
  @Delete('shelter/document/:documentId')
  async deleteShelterDocument(
    @Param('documentId') documentId: string,
    @GetUser() authUser: JWTPayload,
  ) {
    return this.manageShelterService.deleteShelterDocument(
      documentId,
      authUser,
    );
  }

  @ApiOperation({ summary: 'Get own shelter documents' })
  @ValidateManager()
  @Get('shelter/me/document')
  async getOwnShelterDocuments(userId: string) {
    return this.shelterService.getOwnShelterDocuments(userId);
  }

  @ApiOperation({ summary: 'Shelter upload document' })
  @ValidateManager()
  @ApiConsumes('multipart/form-data')
  @Post('shelter/me/document')
  @UseInterceptors(FileInterceptor('document'))
  async uploadMyShelterDocument(
    @GetUser('sub') userId: string,
    @Body() dto: UploadShelterDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'File is required');
    }

    dto.document = file;

    return this.manageShelterService.uploadShelterDocument(userId, dto);
  }

  @ApiOperation({ summary: 'Approve or reject shelter document (admin only)' })
  @ValidateAdmin()
  @Patch('shelter/document/:documentId/approve')
  async approveOrRejectShelterDocument(
    @Param('documentId') documentId: string,
    @Body() dto: ShelterDocumentApproveDto,
  ) {
    return this.manageShelterService.approveOrRejectShelterDocument(
      documentId,
      dto,
    );
  }
}
