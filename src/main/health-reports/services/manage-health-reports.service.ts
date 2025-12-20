import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ManageHealthReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
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

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} driver`,
    );
  }
}
