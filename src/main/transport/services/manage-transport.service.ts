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

  private async addTimeline(
    transportId: string,
    status: TransportStatus,
    note?: string,
    latitude?: number,
    longitude?: number,
  ) {
    await this.prisma.client.transportTimeline.create({
      data: {
        transportId,
        status,
        note,
        latitude,
        longitude,
      },
    });
  }

  private isAdmin(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
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

  private async validateShelterAccess(
    transportShelterId: string | null,
    userId: string,
  ): Promise<void> {
    if (!transportShelterId) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'Unable to modify transport');
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

  @HandleError('Unable to delete transport')
  async deleteTransport(
    transportId: string,
    authUser: JWTPayload,
  ): Promise<TResponse> {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: {
        shelterId: true,
        animalId: true,
        isBondedPair: true,
        bondedPairId: true,
      },
    });

    if (!transport.animalId) {
      throw new AppError(400, 'Transport does not have a primary animal');
    }

    const animalsToReturn = [transport.animalId];
    if (transport.isBondedPair && transport.bondedPairId) {
      animalsToReturn.push(transport.bondedPairId);
    }

    if (this.isAdmin(authUser.role)) {
      await this.prisma.client.$transaction(async (trx) => {
        // Move animals back
        await trx.animal.updateMany({
          where: { id: { in: animalsToReturn } },
          data: { shelterId: transport.shelterId, status: 'AT_SHELTER' },
        });

        // Timeline entry
        await trx.transportTimeline.create({
          data: {
            transportId,
            status: TransportStatus.CANCELLED,
            note: 'Transport deleted by admin',
          },
        });

        // Delete transport
        await trx.transport.delete({ where: { id: transportId } });
      });

      return successResponse(null, 'Transport deleted successfully');
    }

    // Shelter user → check access
    await this.validateShelterAccess(transport.shelterId, authUser.sub);

    await this.prisma.client.$transaction(async (trx) => {
      // Move animals back
      await trx.animal.updateMany({
        where: { id: { in: animalsToReturn } },
        data: { shelterId: transport.shelterId, status: 'AT_SHELTER' },
      });

      // Timeline entry
      await trx.transportTimeline.create({
        data: {
          transportId,
          status: TransportStatus.CANCELLED,
          note: 'Transport deleted by shelter user',
        },
      });

      // Delete transport
      await trx.transport.delete({ where: { id: transportId } });
    });

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

    // Add timeline
    await this.addTimeline(
      transportId,
      updated.status,
      dto.approved ? 'Transport accepted' : 'Transport rejected',
    );

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
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id: transportId },
      select: { shelterId: true, driverId: true, status: true },
    });

    if (!this.isAdmin(authUser.role)) {
      await this.validateShelterAccess(transport.shelterId, authUser.sub);
    }

    if (
      transport.status !== TransportStatus.PENDING &&
      transport.status !== TransportStatus.CANCELLED
    ) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Transport is not pending');
    }

    const updated = await this.prisma.client.transport.update({
      where: { id: transportId },
      data: { driverId },
    });

    // Timeline entry
    await this.addTimeline(
      transportId,
      TransportStatus.PENDING,
      `Driver assigned: ${driverId}`,
    );

    return successResponse(updated, 'Driver assigned successfully');
  }
}
