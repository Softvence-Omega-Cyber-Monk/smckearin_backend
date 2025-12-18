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
    // 1. Validate user and shelter
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId)
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );

    const shelter = await this.prisma.client.shelter.findUniqueOrThrow({
      where: { id: shelterId },
      select: { id: true, status: true },
    });
    if (shelter.status !== 'APPROVED')
      throw new AppError(HttpStatus.FORBIDDEN, 'Shelter is not approved');

    // 2. Validate animal(s)
    const animalsToTransport = [dto.animalId];
    if (dto.isBondedPair && dto.bondedPairId) {
      if (dto.animalId === dto.bondedPairId)
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Animal and bonded pair cannot be the same',
        );
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
      if (animal.status !== 'AT_SHELTER')
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          `${animal.name} is not available for transport`,
        );
    });

    // 3. Create transport
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

    // 4. Update animal status`
    await this.prisma.client.animal.updateMany({
      where: { id: { in: animalsToTransport } },
      data: { status: 'IN_TRANSIT', bondedWithId: dto.bondedPairId ?? null },
    });

    // 5. Create initial timeline
    await this.prisma.client.transportTimeline.create({
      data: {
        transportId: transport.id,
        status: 'PENDING',
        note: 'Transport created',
        latitude: dto.pickUpLatitude,
        longitude: dto.pickUpLongitude,
      },
    });

    return successResponse(transport, 'Transport created successfully');
  }
}
