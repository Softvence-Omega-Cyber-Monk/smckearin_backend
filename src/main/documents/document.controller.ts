import { UserEnum } from '@/common/enum/user.enum';
import { documentUploadConfig } from '@/common/upload/upload.config';
import { GetUser, Roles } from '@/core/jwt/jwt.decorator';
import { JwtAuthGuard, RolesGuard } from '@/core/jwt/jwt.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Foster Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserEnum.FOSTER, UserEnum.FOSTER_ADMIN)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @ApiOperation({ summary: 'Get foster documents' })
  @Get()
  async getDocuments(@GetUser('sub') userId: string) {
    return this.documentService.getDocuments(userId);
  }

  @ApiOperation({ summary: 'Upload foster document' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(FileInterceptor('file', documentUploadConfig))
  async uploadDocument(
    @GetUser('sub') userId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.documentService.uploadDocument(userId, dto.documentType, file);
  }

  @ApiOperation({ summary: 'Delete foster document' })
  @Delete(':id')
  async deleteDocument(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.documentService.deleteDocument(userId, id);
  }

  @ApiOperation({ summary: 'Replace foster document' })
  @ApiConsumes('multipart/form-data')
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', documentUploadConfig))
  async replaceDocument(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.documentService.replaceDocument(
      userId,
      id,
      dto.documentType,
      file,
    );
  }
}
