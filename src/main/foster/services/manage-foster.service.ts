import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UserNotificationService } from '@/lib/queue/services/user-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ManageFosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userNotificationService: UserNotificationService,
    private readonly authMailService: AuthMailService,
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
}
