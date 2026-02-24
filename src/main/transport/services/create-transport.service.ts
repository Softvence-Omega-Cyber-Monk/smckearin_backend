import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { TransportNotificationService } from '@/lib/queue/services/transport-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  RequiredVetClearanceType,
  TransportStatus,
  VetClearance,
  VetClearanceRequestStatus,
} from '@prisma';
import { CreateTransportDto } from '../dto/create-transport.dto';

@Injectable()
export class CreateTransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transportNotificationService: TransportNotificationService,
  ) {}

  @HandleError('Failed to create transport', 'Transport')
  async createTransport(userId: string, dto: CreateTransportDto) {
    // Validate user and shelter
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, shelterAdminOfId: true, managerOfId: true },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const shelter = await this.prisma.client.shelter.findUnique({
      where: { id: shelterId },
      select: { id: true, status: true },
    });

    if (!shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Shelter not found');
    }

    if (shelter.status !== 'APPROVED') {
      throw new AppError(HttpStatus.FORBIDDEN, 'Shelter is not approved');
    }

    // Validate animals
    const animalsToTransport = [dto.animalId];

    if (dto.isBondedPair && dto.bondedPairId) {
      if (dto.animalId === dto.bondedPairId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Animal and bonded pair cannot be the same',
        );
      }
      animalsToTransport.push(dto.bondedPairId);
    }

    const animals = await this.prisma.client.animal.findMany({
      where: { id: { in: animalsToTransport }, shelterId },
    });

    if (animals.length !== animalsToTransport.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'One or more animals do not belong to your shelter',
      );
    }

    animals.forEach((animal) => {
      if (animal.status !== 'AT_SHELTER') {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          `${animal.name} is not available for transport`,
        );
      }
    });

    // Determine if vet clearance is required
    const isVetClearanceRequired =
      dto.vetClearanceType &&
      dto.vetClearanceType !== RequiredVetClearanceType.No;

    const shouldAutoAssignDriver = this.isAnyoneSelection(dto.driverId);
    const shouldAutoAssignVet = this.isAnyoneSelection(dto.vetId);

    let selectedDriverId: string | null = dto.driverId ?? null;
    let selectedVetId: string | null = dto.vetId ?? null;

    if (shouldAutoAssignDriver) {
      const driver = await this.findBestDriver(
        dto.pickUpLatitude,
        dto.pickUpLongitude,
      );
      selectedDriverId = driver.id;
    }

    if (isVetClearanceRequired && shouldAutoAssignVet) {
      const vet = await this.findBestVet();
      selectedVetId = vet.id;
    }

    // Validate vet
    if (isVetClearanceRequired) {
      if (!selectedVetId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Veterinarian is required if vet clearance is required',
        );
      }

      const vet = await this.prisma.client.veterinarian.findUnique({
        where: { id: selectedVetId },
      });

      if (!vet) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');
      }

      if (vet.status !== 'APPROVED') {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'Veterinarian is not approved',
        );
      }
    }

    // Create VetClearanceRequest if required
    let vetClearanceRequestId: string | null = null;

    if (
      isVetClearanceRequired &&
      selectedVetId &&
      dto.vetClearanceType &&
      dto.vetClearanceType !== RequiredVetClearanceType.No
    ) {
      const vetRequest = await this.prisma.client.vetClearanceRequest.create({
        data: {
          vetClearance: this.mapToVetClearance(dto.vetClearanceType),
          status: 'PENDING_REVIEW',
          veterinarianId: selectedVetId,
          notFitReasons: [],
        },
      });

      vetClearanceRequestId = vetRequest.id;
    }

    // Validate driver
    if (selectedDriverId) {
      const driver = await this.prisma.client.driver.findUnique({
        where: { id: selectedDriverId },
      });

      if (!driver) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
      }

      if (driver.status !== 'APPROVED') {
        throw new AppError(HttpStatus.FORBIDDEN, 'Driver is not approved');
      }
    }

    // Create transport
    const transport = await this.prisma.client.transport.create({
      data: {
        transportNote: dto.transportNote,
        priorityLevel: dto.priorityLevel,

        pickUpLocation: dto.pickUpLocation,
        pickUpLatitude: dto.pickUpLatitude,
        pickUpLongitude: dto.pickUpLongitude,

        dropOffLocation: dto.dropOffLocation,
        dropOffLatitude: dto.dropOffLatitude,
        dropOffLongitude: dto.dropOffLongitude,

        transPortDate: new Date(dto.transPortDate),

        animalId: dto.animalId,

        isBondedPair: dto.isBondedPair ?? false,
        bondedPairId: dto.isBondedPair ? dto.bondedPairId : null,

        vetId: selectedVetId,
        driverId: selectedDriverId,
        shelterId,

        isVetClearanceRequired,
        vetClearanceType: dto.vetClearanceType ?? RequiredVetClearanceType.No,

        vetClearanceRequestId,
      },
    });

    // Update animal status
    await this.prisma.client.animal.updateMany({
      where: { id: { in: animalsToTransport } },
      data: { status: 'IN_TRANSIT', bondedWithId: dto.bondedPairId ?? null },
    });

    // Create initial transport timeline
    await this.prisma.client.transportTimeline.create({
      data: {
        transportId: transport.id,
        status: 'PENDING',
        note: 'Transport created',
        latitude: dto.pickUpLatitude,
        longitude: dto.pickUpLongitude,
      },
    });

    // TODO: NOTIFICATION - New Transport Request Created
    // What: Send notification about new transport request
    // Recipients:
    //   1. Assigned driver (if dto.driverId is provided) - via driver.userId
    //   2. Assigned veterinarian (if dto.vetId is provided and isVetClearanceRequired) - via vet.userId
    //   3. All users with role ADMIN or SUPER_ADMIN
    // Settings: tripNotifications, emailNotifications
    // Meta: { transportId: transport.id, animalId: dto.animalId, shelterId, driverId: dto.driverId, vetId: dto.vetId, priorityLevel: dto.priorityLevel, transPortDate: dto.transPortDate, isVetClearanceRequired }
    await this.transportNotificationService.notifyTransportEvent(
      'CREATED',
      transport.id,
      {
        animalId: dto.animalId,
        shelterId,
        driverId: selectedDriverId ?? undefined,
        vetId: selectedVetId ?? undefined,
        priorityLevel: dto.priorityLevel,
        transPortDate: dto.transPortDate,
        isVetClearanceRequired,
      },
    );

    return successResponse(transport, 'Transport created successfully');
  }

  private mapToVetClearance = (
    type: RequiredVetClearanceType,
  ): VetClearance => {
    switch (type) {
      case RequiredVetClearanceType.Health:
        return 'Health';
      case RequiredVetClearanceType.Vaccination:
        return 'Vaccination';
      case RequiredVetClearanceType.Both:
        return 'Both';
      default:
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Invalid vet clearance type for request',
        );
    }
  };

  private isAnyoneSelection(value?: string | null): boolean {
    return typeof value === 'string' && value.trim().toLowerCase() === 'anyone';
  }

  private calculateDistanceMiles(
    pointA: { lat: number; lon: number },
    pointB: { lat: number; lon: number },
  ): number {
    const toRadians = (degree: number) => (degree * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;
    const dLat = toRadians(pointB.lat - pointA.lat);
    const dLon = toRadians(pointB.lon - pointA.lon);
    const lat1 = toRadians(pointA.lat);
    const lat2 = toRadians(pointB.lat);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMiles * c;
  }

  private async findBestDriver(
    pickUpLatitude: number,
    pickUpLongitude: number,
  ) {
    const drivers = await this.prisma.client.driver.findMany({
      where: {
        status: ApprovalStatus.APPROVED,
      },
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        _count: {
          select: {
            transports: {
              where: {
                status: {
                  in: [
                    TransportStatus.PENDING,
                    TransportStatus.ACCEPTED,
                    TransportStatus.PICKED_UP,
                    TransportStatus.IN_TRANSIT,
                  ],
                },
              },
            },
          },
        },
      },
    });

    if (!drivers.length) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'No approved driver is available for auto-selection',
      );
    }

    const withDistance = drivers
      .filter(
        (driver) =>
          driver.currentLatitude !== null && driver.currentLongitude !== null,
      )
      .map((driver) => ({
        ...driver,
        distanceMiles: this.calculateDistanceMiles(
          { lat: pickUpLatitude, lon: pickUpLongitude },
          {
            lat: driver.currentLatitude!,
            lon: driver.currentLongitude!,
          },
        ),
      }))
      .sort((a, b) => {
        if (a.distanceMiles !== b.distanceMiles) {
          return a.distanceMiles - b.distanceMiles;
        }
        return a._count.transports - b._count.transports;
      });

    if (withDistance.length) {
      return withDistance[0];
    }

    return drivers.sort((a, b) => a._count.transports - b._count.transports)[0];
  }

  private async findBestVet() {
    const vets = await this.prisma.client.veterinarian.findMany({
      where: { status: ApprovalStatus.APPROVED },
      select: {
        id: true,
        _count: {
          select: {
            vetClearanceRequests: {
              where: {
                status: {
                  in: [
                    VetClearanceRequestStatus.PENDING_REVIEW,
                    VetClearanceRequestStatus.PENDING_EVALUATION,
                    VetClearanceRequestStatus.NEEDS_VISIT,
                  ],
                },
              },
            },
            transports: {
              where: {
                status: {
                  in: [
                    TransportStatus.PENDING,
                    TransportStatus.ACCEPTED,
                    TransportStatus.PICKED_UP,
                    TransportStatus.IN_TRANSIT,
                  ],
                },
              },
            },
          },
        },
      },
    });

    if (!vets.length) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'No approved veterinarian is available for auto-selection',
      );
    }

    return vets.sort((a, b) => {
      const aLoad = a._count.vetClearanceRequests + a._count.transports;
      const bLoad = b._count.vetClearanceRequests + b._count.transports;

      if (aLoad !== bLoad) {
        return aLoad - bLoad;
      }

      return a._count.vetClearanceRequests - b._count.vetClearanceRequests;
    })[0];
  }
}
