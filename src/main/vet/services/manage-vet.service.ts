import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { DocumentNotificationService } from '@/lib/queue/services/document-notification.service';
import { UserNotificationService } from '@/lib/queue/services/user-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma';
import { UploadVetDocumentDto, VetDocumentApproveDto } from '../dto/vet.dto';

@Injectable()
export class ManageVetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly userNotificationService: UserNotificationService,
    private readonly documentNotificationService: DocumentNotificationService,
  ) {}

  @HandleError('Failed to approve or reject vet')
  async approveOrRejectVet(vetId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    await this.prisma.client.veterinarian.update({
      where: { id: vetId },
      data: { status },
    });

    // TODO: NOTIFICATION - Veterinarian Approval Status Changed
    // What: Send notification about vet approval/rejection decision
    // Recipients: The veterinarian user (via vet.userId)
    // Settings: emailNotifications
    // Meta: { vetId, status, approved: dto.approved }
    await this.userNotificationService.notifyApprovalStatusChange(
      'VET',
      vetId,
      approved,
    );

    return successResponse(null, `${approved ? 'Approved' : 'Rejected'} vet`);
  }

  @HandleError('Failed to delete vet')
  async deleteVet(vetId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const vet = await tx.veterinarian.findUnique({
        where: { id: vetId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!vet) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Vet not found');
      }

      // TODO: NOTIFICATION - Veterinarian Account Deletion
      // What: Send notification about vet account deletion (send BEFORE deletion)
      // Recipients: The veterinarian user (vet.userId)
      // Settings: emailNotifications
      // Meta: { vetId: vet.id, vetName: (fetch from user), vetEmail: (fetch from user) }
      // Note: Fetch user details BEFORE deletion to send notification
      const user = await tx.user.findUnique({
        where: { id: vet.userId },
        select: { name: true, email: true },
      });
      if (user) {
        await this.userNotificationService.notifyAccountDeletion(
          'VET',
          vet.userId,
          { name: user.name, email: user.email },
        );
      }

      // Delete vet first
      await tx.veterinarian.delete({
        where: { id: vetId },
      });

      // Delete user - 1:1 relationship strong coupling
      await tx.user.delete({
        where: { id: vet.userId },
      });

      return successResponse(null, 'Vet and user deleted successfully');
    });
  }

  @HandleError('Failed to upload vet document')
  async uploadVetDocument(userId: string, dto: UploadVetDocumentDto) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Vet profile not found');
    }

    // Upload file
    const uploadedFile = await this.s3.uploadFile(dto.document);

    // Create VetDocument
    const doc = await this.prisma.client.vetDocument.create({
      data: {
        vetId: vet.id,
        documentId: uploadedFile.id,
        documentUrl: uploadedFile.url,
        status: ApprovalStatus.PENDING,
        type: dto.type,
        name: dto.name,
      },
      include: {
        document: true,
      },
    });

    // TODO: NOTIFICATION - New Vet Document Uploaded
    // What: Send notification about new vet document requiring approval
    // Recipients: All users with role SUPER_ADMIN or ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { vetId: vet.id, vetName: (fetch from user), documentType: dto.type, documentName: dto.name, documentId: doc.id }
    await this.documentNotificationService.notifyDocumentEvent(
      'VET_DOCUMENT_UPLOADED',
      vet.id,
      { name: dto.name, type: dto.type, vetId: vet.id },
    );

    return successResponse(doc, 'Document uploaded successfully');
  }

  @HandleError('Failed to delete vet document')
  async deleteVetDocument(documentId: string, authUser: JWTPayload) {
    const doc = await this.prisma.client.vetDocument.findUnique({
      where: {
        id: documentId,
      },
    });

    if (!doc) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    const isAdmin =
      authUser.role === UserRole.ADMIN ||
      authUser.role === UserRole.SUPER_ADMIN;

    // Check if user is owner of this vet profile
    const isOwner = await this.prisma.client.veterinarian.findFirst({
      where: {
        id: doc.vetId,
        userId: authUser.sub,
      },
    });

    if (!isAdmin && !isOwner) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    // Delete from DB
    await this.prisma.client.vetDocument.delete({
      where: { id: doc.id },
    });

    // Delete from S3
    await this.s3.deleteFile(doc.documentId);

    return successResponse(null, 'Document deleted successfully');
  }

  @HandleError('Failed to approve or reject vet document')
  async approveOrRejectVetDocument(
    documentId: string,
    dto: VetDocumentApproveDto,
  ) {
    const doc = await this.prisma.client.vetDocument.findUnique({
      where: {
        id: documentId,
      },
    });

    if (!doc) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    const status = dto.approved
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.REJECTED;

    await this.prisma.client.vetDocument.update({
      where: { id: doc.id },
      data: { status },
    });

    // TODO: NOTIFICATION - Vet Document Approval Status Changed
    // What: Send notification about vet document approval/rejection
    // Recipients: The veterinarian user (via doc.vetId -> vet.userId)
    // Settings: emailNotifications, certificateNotifications
    // Meta: { vetId: doc.vetId, documentType: doc.type, documentName: doc.name, status, approved: dto.approved }
    await this.documentNotificationService.notifyDocumentEvent(
      'VET_DOCUMENT_APPROVED',
      doc.vetId,
      {
        name: doc.name,
        type: doc.type,
        approved: dto.approved,
        vetId: doc.vetId,
      },
    );

    return successResponse(
      null,
      `Document ${dto.approved ? 'approved' : 'rejected'} successfully`,
    );
  }
}
