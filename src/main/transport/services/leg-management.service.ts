import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus, TransportLegStatus, TransportStatus } from '@prisma';
import {
  AssignLegDriverDto,
  UpdateTransportLegStatusDto,
} from '../dto/transport-leg.dto';

@Injectable()
export class LegManagementService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to assign driver to leg', 'TransportLeg')
  async assignDriverToLeg(legId: string, dto: AssignLegDriverDto) {
    const leg = await this.prisma.client.transportLeg.findUnique({
      where: { id: legId },
      include: { transport: { select: { id: true, isMultiLeg: true } } },
    });

    if (!leg) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport leg not found');
    }

    if (!leg.transport.isMultiLeg) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Cannot assign driver to legs of a single-leg transport',
      );
    }

    const driver = await this.prisma.client.driver.findUnique({
      where: { id: dto.driverId },
      select: { id: true, status: true },
    });

    if (!driver) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
    }

    if (driver.status !== ApprovalStatus.APPROVED) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Driver is not approved');
    }

    const updatedLeg = await this.prisma.client.transportLeg.update({
      where: { id: legId },
      data: {
        driverId: dto.driverId,
        status:
          leg.status === TransportLegStatus.PENDING
            ? TransportLegStatus.ASSIGNED
            : leg.status,
      },
    });

    return successResponse(updatedLeg, 'Driver assigned to leg successfully');
  }

  @HandleError('Failed to update leg status', 'TransportLeg')
  async updateLegStatus(legId: string, dto: UpdateTransportLegStatusDto) {
    const leg = await this.prisma.client.transportLeg.findUnique({
      where: { id: legId },
      include: { transport: { select: { id: true, isMultiLeg: true } } },
    });

    if (!leg) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport leg not found');
    }

    if (!leg.transport.isMultiLeg) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Cannot update leg status of a single-leg transport',
      );
    }

    // Build update data based on status
    const updateData: Record<string, unknown> = { status: dto.status };

    if (dto.status === TransportLegStatus.PICKED_UP) {
      updateData.actualPickUpAt = new Date();
    }

    if (
      dto.status === TransportLegStatus.DELIVERED ||
      dto.status === TransportLegStatus.COMPLETED
    ) {
      updateData.actualDropOffAt = new Date();
    }

    const updatedLeg = await this.prisma.client.transportLeg.update({
      where: { id: legId },
      data: updateData,
    });

    // Synchronize parent transport status
    await this.syncTransportStatus(leg.transportId);

    return successResponse(updatedLeg, 'Leg status updated successfully');
  }

  @HandleError('Failed to get transport legs', 'TransportLeg')
  async getTransportLegs(transportId: string) {
    const transport = await this.prisma.client.transport.findUnique({
      where: { id: transportId },
      select: { id: true, isMultiLeg: true },
    });

    if (!transport) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport not found');
    }

    if (!transport.isMultiLeg) {
      return successResponse([], 'This is not a multi-leg transport');
    }

    const legs = await this.prisma.client.transportLeg.findMany({
      where: { transportId },
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, email: true, profilePictureUrl: true },
            },
          },
        },
      },
      orderBy: { sequenceOrder: 'asc' },
    });

    return successResponse(legs, 'Transport legs retrieved successfully');
  }

  /**
   * Synchronizes the parent transport status based on its legs' statuses.
   *
   * Rules:
   *  - Any leg is PICKED_UP or IN_TRANSIT → transport becomes IN_TRANSIT
   *  - All legs are COMPLETED → transport becomes COMPLETED
   *  - Any leg is CANCELED and all others are COMPLETED or CANCELED → transport becomes COMPLETED
   */
  private async syncTransportStatus(transportId: string): Promise<void> {
    const legs = await this.prisma.client.transportLeg.findMany({
      where: { transportId },
      select: { status: true },
    });

    if (legs.length === 0) {
      return;
    }

    const statuses = legs.map((l) => l.status);

    const allCompleted = statuses.every(
      (s) =>
        s === TransportLegStatus.COMPLETED || s === TransportLegStatus.CANCELED,
    );

    const anyActive = statuses.some(
      (s) =>
        s === TransportLegStatus.PICKED_UP ||
        s === TransportLegStatus.IN_TRANSIT,
    );

    let newTransportStatus: TransportStatus | null = null;

    if (allCompleted) {
      newTransportStatus = TransportStatus.COMPLETED;
    } else if (anyActive) {
      newTransportStatus = TransportStatus.IN_TRANSIT;
    }

    if (newTransportStatus) {
      await this.prisma.client.transport.update({
        where: { id: transportId },
        data: {
          status: newTransportStatus,
          ...(newTransportStatus === TransportStatus.COMPLETED
            ? { completedAt: new Date() }
            : {}),
        },
      });
    }
  }
}
