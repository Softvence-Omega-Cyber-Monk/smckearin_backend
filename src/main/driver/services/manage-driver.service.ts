import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ManageDriverService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to approve or reject driver')
  async approveOrRejectDriver(driverId: string, dto: ApproveOrRejectDto) {
    const { approved } = dto;
    const status = approved ? 'APPROVED' : 'REJECTED';

    await this.prisma.client.driver.update({
      where: { id: driverId },
      data: { status },
    });

    return successResponse(
      null,
      `${approved ? 'Approved' : 'Rejected'} driver`,
    );
  }

  @HandleError('Failed to delete driver')
  async deleteDriver(driverId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!driver) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
      }

      // 1Delete driver first
      await tx.driver.delete({
        where: { id: driverId },
      });

      // Delete user
      await tx.user.delete({
        where: { id: driver.userId },
      });

      return successResponse(null, 'Driver and user deleted successfully');
    });
  }
}
