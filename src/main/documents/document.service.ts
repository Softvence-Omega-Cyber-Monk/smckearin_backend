import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentStatusEnum, DocumentTypeEnum } from './enums/document.enum';

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get foster documents')
  async getDocuments(userId: string) {
    const documents =
      (await (this.prisma.client as any).fosterDocument?.findMany?.({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
      })) ?? [];

    return successResponse(
      documents.map((document: any) => ({
        id: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSizeMb: document.fileSizeMb,
        mimeType: document.mimeType,
        status: document.status,
        uploadedAt: document.uploadedAt,
        reviewNote: document.reviewNote,
      })),
      'Documents fetched successfully',
    );
  }

  @HandleError('Failed to upload foster document')
  async uploadDocument(
    userId: string,
    documentType: DocumentTypeEnum,
    file: Express.Multer.File,
  ) {
    const fosterDocumentDelegate = (this.prisma.client as any).fosterDocument;
    if (!fosterDocumentDelegate) {
      throw new AppError(500, 'Foster document model is not available');
    }

    const fileSizeMb = +(file.size / (1024 * 1024)).toFixed(2);
    const fileUrl = `/uploads/documents/${file.filename}`;
    const fileKey = file.filename;

    const document = await fosterDocumentDelegate.create({
      data: {
        userId,
        documentType,
        fileName: file.originalname,
        fileUrl,
        fileKey,
        fileSizeMb,
        mimeType: file.mimetype,
        status: DocumentStatusEnum.PENDING,
      },
    });

    return successResponse(document, 'Document uploaded successfully');
  }

  @HandleError('Failed to delete foster document')
  async deleteDocument(userId: string, documentId: string) {
    const fosterDocumentDelegate = (this.prisma.client as any).fosterDocument;
    if (!fosterDocumentDelegate) {
      throw new AppError(500, 'Foster document model is not available');
    }

    const document = await fosterDocumentDelegate.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === DocumentStatusEnum.APPROVED) {
      throw new BadRequestException('Approved documents cannot be deleted');
    }

    try {
      const filePath = path.join(
        process.cwd(),
        'uploads',
        'documents',
        document.fileKey,
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) {}

    await fosterDocumentDelegate.delete({
      where: { id: documentId },
    });

    return successResponse(
      { message: 'Document deleted successfully.' },
      'Document deleted successfully',
    );
  }

  @HandleError('Failed to replace foster document')
  async replaceDocument(
    userId: string,
    documentId: string,
    documentType: DocumentTypeEnum,
    file: Express.Multer.File,
  ) {
    const fosterDocumentDelegate = (this.prisma.client as any).fosterDocument;
    if (!fosterDocumentDelegate) {
      throw new AppError(500, 'Foster document model is not available');
    }

    const document = await fosterDocumentDelegate.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    try {
      const filePath = path.join(
        process.cwd(),
        'uploads',
        'documents',
        document.fileKey,
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) {}

    const fileSizeMb = +(file.size / (1024 * 1024)).toFixed(2);
    const fileUrl = `/uploads/documents/${file.filename}`;

    const updatedDocument = await fosterDocumentDelegate.update({
      where: { id: document.id },
      data: {
        documentType,
        fileName: file.originalname,
        fileUrl,
        fileKey: file.filename,
        fileSizeMb,
        mimeType: file.mimetype,
        status: DocumentStatusEnum.PENDING,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    return successResponse(updatedDocument, 'Document replaced successfully');
  }
}
