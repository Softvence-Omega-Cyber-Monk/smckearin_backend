import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RequiredVetClearanceType } from '@prisma';
import { CreateTransportDto } from '../dto/create-transport.dto';

@Injectable()
export class CreateTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Unable to create transport')
  async createTransport(userId: string, dto: CreateTransportDto) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    // check if shelter if shelter is approved
    const shelter = await this.prisma.client.shelter.findUniqueOrThrow({
      where: { id: shelterId },
      select: {
        id: true,
        status: true,
      },
    });

    if (shelter.status !== 'APPROVED') {
      throw new AppError(HttpStatus.FORBIDDEN, 'Shelter is not approved');
    }

    // Validate animal ownership (must belong to same shelter)
    const animal = await this.prisma.client.animal.findFirst({
      where: {
        id: dto.animalId,
        shelterId,
      },
    });

    if (!animal) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal does not belong to your shelter',
      );
    }

    if (animal.status !== 'AT_SHELTER') {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal is not available for transport',
      );
    }

    // Bonded pair validation
    if (dto.isBondedPair) {
      if (!dto.bondedPairId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'bondedPairId is required when isBondedPair is true',
        );
      }

      if (dto.animalId === dto.bondedPairId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Animal and bonded pair cannot be the same',
        );
      }

      const bondedAnimal = await this.prisma.client.animal.findFirst({
        where: {
          id: dto.bondedPairId,
          shelterId,
        },
      });

      if (!bondedAnimal) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Bonded pair animal does not belong to your shelter',
        );
      }

      if (bondedAnimal.status !== 'AT_SHELTER') {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Bonded pair animal is not available for transport',
        );
      }
    }

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
        transPortTime: new Date(dto.transPortTime),

        animalId: dto.animalId,

        isBondedPair: dto.isBondedPair ?? false,
        bondedPairId: dto.isBondedPair ? dto.bondedPairId : null,

        vetId: dto.vetId ?? null,
        driverId: dto.driverId ?? null,
        shelterId,

        isVetClearanceRequired: dto.vetClearanceType
          ? dto.vetClearanceType !== RequiredVetClearanceType.No
          : false,
        vetClearanceType: dto.vetClearanceType,
      },
    });

    await this.prisma.client.animal.update({
      where: { id: dto.animalId },
      data: { status: 'IN_TRANSIT' },
    });

    if (dto.isBondedPair && dto.bondedPairId) {
      await this.prisma.client.animal.update({
        where: { id: dto.bondedPairId },
        data: { status: 'IN_TRANSIT' },
      });
      await this.prisma.client.animal.update({
        where: { id: dto.animalId },
        data: { bondedWithId: dto.bondedPairId },
      });
    }

    return successResponse(transport, 'Transport created successfully');
  }
}
