import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { AppError } from '@/core/error/handle-error.app';
import {
  GetUser,
  ValidateAdmin,
  ValidateAuth,
  ValidateVeterinarian,
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
import { GetApprovedVets, GetVetsDto } from '../dto/get-vets.dto';
import { UploadVetDocumentDto, VetDocumentApproveDto } from '../dto/vet.dto';
import { GetVetService } from '../services/get-vet.service';
import { ManageVetService } from '../services/manage-vet.service';

@ApiTags('Vet')
@ApiBearerAuth()
@ValidateAuth()
@Controller('vet')
export class VetController {
  constructor(
    private readonly vetService: GetVetService,
    private readonly manageVetService: ManageVetService,
  ) {}

  @ApiOperation({ summary: 'Get all vets (admin only)' })
  @ValidateAdmin()
  @Get('vet')
  async getVets(@Query() body: GetVetsDto) {
    return this.vetService.getAllVets(body);
  }

  @ApiOperation({ summary: 'Get all approved vets' })
  @Get('vet/approved')
  async getApprovedVets(@Query() body: GetApprovedVets) {
    return this.vetService.getApprovedVets(body);
  }

  @ApiOperation({ summary: 'Get single vet by id' })
  @Get('vet/:vetId')
  async getSingleVet(@Param('vetId') vetId: string) {
    return this.vetService.getSingleVet(vetId);
  }

  @ApiOperation({ summary: 'Approve or reject vet (admin only)' })
  @ValidateAdmin()
  @Get('vet/:vetId/approve')
  async approveOrRejectVet(
    @Param('vetId') vetId: string,
    @Query() dto: ApproveOrRejectDto,
  ) {
    return this.manageVetService.approveOrRejectVet(vetId, dto);
  }

  @ApiOperation({ summary: 'Delete vet (admin only)' })
  @ValidateAdmin()
  @Delete('vet/:vetId/delete')
  async deleteVet(@Param('vetId') vetId: string) {
    return this.manageVetService.deleteVet(vetId);
  }

  @ApiOperation({ summary: 'Delete vet document' })
  @ValidateVeterinarian()
  @Delete('vet/document/:documentId')
  async deleteVetDocument(
    @Param('documentId') documentId: string,
    @GetUser() authUser: JWTPayload,
  ) {
    return this.manageVetService.deleteVetDocument(documentId, authUser);
  }

  @ApiOperation({ summary: 'Get own vet documents' })
  @ValidateVeterinarian()
  @Get('vet/me/document')
  async getOwnVetDocuments(@GetUser('sub') userId: string) {
    return this.vetService.getOwnVetDocuments(userId);
  }

  @ApiOperation({ summary: 'Vet upload document' })
  @ValidateVeterinarian()
  @ApiConsumes('multipart/form-data')
  @Post('vet/me/document')
  @UseInterceptors(FileInterceptor('document'))
  async uploadMyVetDocument(
    @GetUser('sub') userId: string,
    @Body() dto: UploadVetDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'File is required');
    }

    dto.document = file;

    return this.manageVetService.uploadVetDocument(userId, dto);
  }

  @ApiOperation({ summary: 'Approve or reject vet document (admin only)' })
  @ValidateAdmin()
  @Patch('vet/document/:documentId/approve')
  async approveOrRejectVetDocument(
    @Param('documentId') documentId: string,
    @Body() dto: VetDocumentApproveDto,
  ) {
    return this.manageVetService.approveOrRejectVetDocument(documentId, dto);
  }
}
