import { ApproveOrRejectDto } from '@/common/dto/approve-reject.dto';
import { successResponse, TResponse } from '@/common/utils/response.util';
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
  ): Promise<TResponse> {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: { shelterId: true },
    });

    if (this.isAdmin(authUser.role)) {
      await this.deleteById(transportId);
      return successResponse(null, 'Transport deleted successfully');
    }

    await this.validateShelterAccess(transport.shelterId, authUser.sub);
    await this.deleteById(transportId);

    return successResponse(null, 'Transport deleted successfully');
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

  @HandleError('Unable to assign driver to transport')
  async assignDriverToTransport(
    authUser: JWTPayload,
    transportId: string,
    driverId: string,
  ) {
    // check user is admin or owner of the transport
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: { shelterId: true, driverId: true, status: true },
    });

    if (!this.isAdmin(authUser.role)) {
      await this.validateShelterAccess(transport.shelterId, authUser.sub);
    }

    // check if transport is pending or cancelled
    if (
      transport.status !== TransportStatus.PENDING &&
      transport.status !== TransportStatus.CANCELLED
    ) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Transport is not pending');
    }

    await this.prisma.client.transport.update({
      where: { id: transportId },
      data: { driverId },
    });
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
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'Transport does not belong to you',
      );
    }
  }

  private async deleteById(transportId: string): Promise<void> {
    await this.prisma.client.transport.delete({
      where: { id: transportId },
    });
  }
}
