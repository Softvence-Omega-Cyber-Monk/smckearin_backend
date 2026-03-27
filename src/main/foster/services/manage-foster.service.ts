import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { DocumentNotificationService } from '@/lib/queue/services/document-notification.service';
import { UserNotificationService } from '@/lib/queue/services/user-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma';
import {
  FosterDocumentApproveDto,
  UploadFosterDocumentDto,
} from '../dto/foster.dto';

@Injectable()
export class ManageFosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly userNotificationService: UserNotificationService,
    private readonly authMailService: AuthMailService,
    private readonly documentNotificationService: DocumentNotificationService,
  ) {}

  @HandleError('Failed to approve or reject foster')
  async approveOrRejectFoster(fosterId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    const foster = await this.prisma.client.foster.update({
      where: { id: fosterId },
      data: { status },
      include: { user: true },
    });

    await this.userNotificationService.notifyApprovalStatusChange(
      'FOSTER',
      fosterId,
      approved,
    );

    if (approved) {
      await this.authMailService.sendAccountApprovedEmail(
        foster.user.email,
        foster.user.name,
        'Foster',
      );
    }

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} foster`,
    );
  }

  @HandleError('Failed to delete foster')
  async deleteFoster(fosterId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const foster = await tx.foster.findUnique({
        where: { id: fosterId },
        include: { user: true },
      });

      if (!foster) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Foster not found');
      }

      await this.userNotificationService.notifyAccountDeletion(
        'FOSTER',
        foster.userId,
        { name: foster.user.name, email: foster.user.email },
      );

      await tx.foster.delete({
        where: { id: fosterId },
      });

      await tx.user.delete({
        where: { id: foster.userId },
      });

      return successResponse(null, 'Foster and user deleted successfully');
    });
  }

  @HandleError('Failed to upload foster document')
  async uploadFosterDocument(userId: string, dto: UploadFosterDocumentDto) {
    const foster = await this.prisma.client.foster.findUnique({
      where: { userId },
    });

    if (!foster) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Foster account not found');
    }

    const uploadedFile = await this.s3.uploadFile(dto.document);

    const doc = await this.prisma.client.fosterDocument.create({
      data: {
        fosterId: foster.id,
        documentId: uploadedFile.id,
        documentUrl: uploadedFile.url,
        status: ApprovalStatus.PENDING,
        type: dto.type,
        name: dto.name,
      },
    });

    await this.documentNotificationService.notifyDocumentEvent(
      'FOSTER_DOCUMENT_UPLOADED',
      doc.id,
      { name: dto.name, type: dto.type },
    );

    return successResponse(doc, 'Document uploaded successfully');
  }

  @HandleError('Failed to delete foster document')
  async deleteFosterDocument(documentId: string, authUser: JWTPayload) {
    const doc = await this.prisma.client.fosterDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    const isAdmin =
      authUser.role === UserRole.ADMIN ||
      authUser.role === UserRole.SUPER_ADMIN;

    const isFosterOwner = await this.prisma.client.foster.count({
      where: {
        id: doc.fosterId,
        userId: authUser.sub,
      },
    });

    if (!isAdmin && !isFosterOwner) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    await this.prisma.client.fosterDocument.delete({
      where: { id: doc.id },
    });

    await this.s3.deleteFile(doc.documentId);

    return successResponse(null, 'Document deleted successfully');
  }

  @HandleError('Failed to approve or reject foster document')
  async approveOrRejectFosterDocument(
    documentId: string,
    dto: FosterDocumentApproveDto,
  ) {
    const doc = await this.prisma.client.fosterDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    const status = dto.approved
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.REJECTED;

    await this.prisma.client.fosterDocument.update({
      where: { id: doc.id },
      data: { status },
    });

    await this.documentNotificationService.notifyDocumentEvent(
      'FOSTER_DOCUMENT_APPROVED',
      documentId,
      { approved: dto.approved },
    );

    return successResponse(
      null,
      `Document ${dto.approved ? 'approved' : 'rejected'} successfully`,
    );
  }
}
