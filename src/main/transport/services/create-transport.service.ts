import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RequiredVetClearanceType, VetClearance } from '@prisma';
import { CreateTransportDto } from '../dto/create-transport.dto';

@Injectable()
export class CreateTransportService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Validate vet
    if (isVetClearanceRequired) {
      if (!dto.vetId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Veterinarian is required if vet clearance is required',
        );
      }

      const vet = await this.prisma.client.veterinarian.findUnique({
        where: { id: dto.vetId },
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
      dto.vetId &&
      dto.vetClearanceType &&
      dto.vetClearanceType !== RequiredVetClearanceType.No
    ) {
      const vetRequest = await this.prisma.client.vetClearanceRequest.create({
        data: {
          vetClearance: this.mapToVetClearance(dto.vetClearanceType),
          status: 'PENDING_REVIEW',
          veterinarianId: dto.vetId ?? null,
          notFitReasons: [],
        },
      });

      vetClearanceRequestId = vetRequest.id;
    }

    // Validate driver
    if (dto.driverId) {
      const driver = await this.prisma.client.driver.findUnique({
        where: { id: dto.driverId },
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

        vetId: dto.vetId ?? null,
        driverId: dto.driverId ?? null,
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
}
