import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { TransportStatus, UserRole } from '@prisma';

@Injectable()
export class ManageTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Unable to delete transport')
  async deleteTransport(
    transportId: string,
    authUser: JWTPayload,
  ): Promise<void> {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: { shelterId: true },
    });

    if (this.isAdmin(authUser.role)) {
      await this.deleteById(transportId);
      return;
    }

    await this.validateShelterAccess(transport.shelterId, authUser.sub);
    await this.deleteById(transportId);
  }

  private isAdmin(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }

  private async validateShelterAccess(
    transportShelterId: string | null,
    userId: string,
  ): Promise<void> {
    if (!transportShelterId) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'Unable to delete transport');
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const userShelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (userShelterId !== transportShelterId) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'Unable to delete transport');
    }
  }

  private async deleteById(transportId: string): Promise<void> {
    await this.prisma.client.transport.delete({
      where: { id: transportId },
    });
  }

  @HandleError('Unable to accept or reject transport')
  async acceptOrRejectTransport(
    transportId: string,
    authUser: JWTPayload,
    dto: ApproveOrRejectDto,
  ) {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: {
        id: true,
        driverId: true,
        status: true,
      },
    });

    await this.validateDriverOwnership(transport.driverId, authUser.sub);

    const updated = await this.prisma.client.transport.update({
      where: { id: transportId },
      data: {
        status: dto.approved
          ? TransportStatus.ACCEPTED
          : TransportStatus.CANCELLED,
      },
    });

    return successResponse(
      updated,
      `Transport ${dto.approved ? 'accepted' : 'rejected'} successfully`,
    );
  }

  private async validateDriverOwnership(
    driverId: string | null,
    userId: string,
  ): Promise<void> {
    if (!driverId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Transport has no driver assigned',
      );
    }

    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { id: driverId },
      select: { userId: true },
    });

    if (driver.userId !== userId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You are not allowed to modify this transport',
      );
    }
  }
}
