import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { VetNotificationService } from '@/lib/queue/services/vet-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UpdateHealthReportDto } from '../dto/health-report.dto';

@Injectable()
export class ManageHealthReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly vetNotificationService: VetNotificationService,
  ) {}

  @HandleError('Failed to delete health report')
  async deleteHealthReport(reportId: string, authUser: JWTPayload) {
    // Fetch report
    const report = await this.prisma.client.healthReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Health report not found');
    }

    const isAdmin =
      authUser.role === 'ADMIN' || authUser.role === 'SUPER_ADMIN';

    // Fetch vet for current user
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId: authUser.sub },
      select: { id: true },
    });

    const isOwner = vet?.id === report.veterinarianId;

    if (!isAdmin && !isOwner) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    // TODO: NOTIFICATION - Health Report Deleted
    // What: Send notification about health report deletion
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the animal's shelter (via report.animalId -> animal.shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { reportId: report.id, animalId: report.animalId, shelterId: (fetch from animal), veterinarianId: report.veterinarianId }
    // Note: Fetch animal and shelter details BEFORE deletion
    await this.vetNotificationService.notifyHealthReportEvent(
      'DELETED',
      reportId,
    );

    // Delete from DB
    await this.prisma.client.healthReport.delete({
      where: { id: report.id },
    });

    // Delete report file from S3 if exists
    if (report.reportId) {
      await this.s3.deleteFile(report.reportId);
    }

    return successResponse(null, 'Health report deleted successfully');
  }

  @HandleError('Unable to approve/reject report')
  async approveOrReject(reportId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    await this.prisma.client.healthReport.update({
      where: { id: reportId },
      data: { status },
    });

    // TODO: NOTIFICATION - Health Report Approval Status Changed
    // What: Send notification about health report approval/rejection
    // Recipients:
    //   1. The veterinarian who created the report (via report.veterinarianId -> vet.userId)
    //   2. All SHELTER_ADMIN and MANAGER users of the animal's shelter (fetch via report.animalId -> animal.shelterId)
    // Settings: emailNotifications, certificateNotifications
    // Meta: { reportId, animalId: (fetch from report), shelterId: (fetch from animal), veterinarianId: (fetch from report), status, approved: dto.approved }
    await this.vetNotificationService.notifyHealthReportEvent(
      approved ? 'APPROVED' : 'REJECTED',
      reportId,
    );

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} driver`,
    );
  }

  @HandleError('Failed to update health report')
  async updateHealthReport(
    reportId: string,
    dto: UpdateHealthReportDto,
    authUser: JWTPayload,
  ) {
    // Fetch the existing health report
    const report = await this.prisma.client.healthReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Health report not found');
    }

    // Only admin or report owner (vet) can update
    const isAdmin =
      authUser.role === 'ADMIN' || authUser.role === 'SUPER_ADMIN';

    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId: authUser.sub },
      select: { id: true },
    });

    const isOwner = vet?.id === report.veterinarianId;

    if (!isAdmin && !isOwner) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden');
    }

    let reportIdToSave = report.reportId;
    let reportIdUrlToSave = report.reportIdUrl;

    // Handle new file upload
    if (dto.report) {
      // Delete old file if exists
      if (report.reportId) {
        await this.s3.deleteFile(report.reportId);
      }

      // Upload new file
      const uploadedFile = await this.s3.uploadFile(dto.report);
      reportIdToSave = uploadedFile.id;
      reportIdUrlToSave = uploadedFile.url;
    }

    // Update only health report fields
    const updatedReport = await this.prisma.client.healthReport.update({
      where: { id: reportId },
      data: {
        reportType: dto.reportType ?? report.reportType,
        note: dto.note ?? report.note,
        reportId: reportIdToSave,
        reportIdUrl: reportIdUrlToSave,
      },
      include: {
        veterinarian: true,
        animal: { include: { image: true, shelter: true } },
        report: true,
      },
    });

    // TODO: NOTIFICATION - Health Report Updated
    // What: Send notification about health report update
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the animal's shelter (via report.animalId -> animal.shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { reportId, animalId: report.animalId, shelterId: (fetch from animal), veterinarianId: report.veterinarianId, reportType: updatedReport.reportType }
    await this.vetNotificationService.notifyHealthReportEvent(
      'UPDATED',
      reportId,
    );

    return successResponse(updatedReport, 'Health report updated successfully');
  }
}
