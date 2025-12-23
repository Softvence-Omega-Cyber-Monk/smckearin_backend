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
import {
  ShelterDocumentApproveDto,
  UploadShelterDocumentDto,
} from '../dto/shelter.dto';

@Injectable()
export class ManageShelterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly userNotificationService: UserNotificationService,
    private readonly documentNotificationService: DocumentNotificationService,
  ) {}

  @HandleError('Failed to approve or reject shelter')
  async approveOrRejectShelter(shelterId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    await this.prisma.client.shelter.update({
      where: { id: shelterId },
      data: { status },
    });

    // TODO: NOTIFICATION - Shelter Approval Status Changed
    // What: Send notification about shelter approval/rejection decision
    // Recipients:
    //   1. All SHELTER_ADMIN users of this shelter
    //   2. All MANAGER users of this shelter
    // Settings: emailNotifications
    // Meta: { shelterId, status, approved: dto.approved }
    await this.userNotificationService.notifyApprovalStatusChange(
      'SHELTER',
      shelterId,
      approved,
    );

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} shelter`,
    );
  }

  @HandleError('Failed to delete shelter')
  async deleteShelter(shelterId: string) {
    // Fetch shelter details before deletion for notification
    const shelter = await this.prisma.client.shelter.findUnique({
      where: { id: shelterId },
      select: { id: true, name: true },
    });

    // TODO: NOTIFICATION - Shelter Deletion
    // What: Send notification about shelter deletion (send BEFORE deletion)
    // Recipients:
    //   1. All SHELTER_ADMIN users of this shelter
    //   2. All MANAGER users of this shelter
    // Settings: emailNotifications
    // Meta: { shelterId, shelterName: (fetch shelter name before deletion) }
    // Note: Fetch shelter and team member details BEFORE deletion to send notifications
    // Note: Notification is sent in the transaction before deletion

    await this.prisma.client.$transaction(async (tx) => {
      // delete associated members
      await tx.user.deleteMany({
        where: {
          OR: [{ shelterAdminOfId: shelterId }, { managerOfId: shelterId }],
        },
      });

      // delete shelter
      await tx.shelter.delete({
        where: { id: shelterId },
      });
    });

    return successResponse(
      null,
      'Shelter with its members deleted successfully',
    );
  }

  @HandleError('Failed to upload shelter document')
  async uploadShelterDocument(userId: string, dto: UploadShelterDocumentDto) {
    const shelter = await this.prisma.client.shelter.findFirst({
      where: {
        OR: [
          { shelterAdmins: { some: { id: userId } } },
          { managers: { some: { id: userId } } },
        ],
      },
    });

    if (!shelter) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'Shelter not found for this user',
      );
    }

    // Upload file
    const uploadedFile = await this.s3.uploadFile(dto.document);

    // Create ShelterDocument
    const doc = await this.prisma.client.shelterDocument.create({
      data: {
        shelterId: shelter.id,
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

    // TODO: NOTIFICATION - New Shelter Document Uploaded
    // What: Send notification about new shelter document requiring approval
    // Recipients: All users with role SUPER_ADMIN or ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { shelterId: shelter.id, shelterName: shelter.name, documentType: dto.type, documentName: dto.name, documentId: doc.id }
    await this.documentNotificationService.notifyDocumentEvent(
      'SHELTER_DOCUMENT_UPLOADED',
      doc.id,
      { name: dto.name, type: dto.type },
    );

    return successResponse(doc, 'Document uploaded successfully');
  }

  @HandleError('Failed to delete shelter document')
  async deleteShelterDocument(documentId: string, authUser: JWTPayload) {
    const doc = await this.prisma.client.shelterDocument.findUnique({
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

    // Check if user is manager/admin of THIS shelter
    const isShelterMember = await this.prisma.client.shelter.count({
      where: {
        id: doc.shelterId,
        OR: [
          { shelterAdmins: { some: { id: authUser.sub } } },
          { managers: { some: { id: authUser.sub } } },
        ],
      },
    });

    if (!isAdmin && !isShelterMember) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    // Delete from DB
    await this.prisma.client.shelterDocument.delete({
      where: { id: doc.id },
    });

    // Delete from S3
    await this.s3.deleteFile(doc.documentId);

    return successResponse(null, 'Document deleted successfully');
  }

  @HandleError('Failed to approve or reject shelter document')
  async approveOrRejectShelterDocument(
    documentId: string,
    dto: ShelterDocumentApproveDto,
  ) {
    const doc = await this.prisma.client.shelterDocument.findFirst({
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

    await this.prisma.client.shelterDocument.update({
      where: { id: doc.id },
      data: { status },
    });

    // TODO: NOTIFICATION - Shelter Document Approval Status Changed
    // What: Send notification about shelter document approval/rejection
    // Recipients:
    //   1. All SHELTER_ADMIN users of the shelter
    //   2. All MANAGER users of the shelter
    // Settings: emailNotifications, certificateNotifications
    // Meta: { shelterId: doc.shelterId, documentType: doc.type, documentName: doc.name, status, approved: dto.approved }
    await this.documentNotificationService.notifyDocumentEvent(
      'SHELTER_DOCUMENT_APPROVED',
      documentId,
      { approved: dto.approved },
    );

    return successResponse(
      null,
      `Document ${dto.approved ? 'approved' : 'rejected'} successfully`,
    );
  }
}
