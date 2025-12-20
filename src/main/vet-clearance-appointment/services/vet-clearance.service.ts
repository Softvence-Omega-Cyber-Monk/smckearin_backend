import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import { GetVetClearanceDto } from '../dto/vet-appointment-clearance.dto';

@Injectable()
export class VetClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to get vet clearance')
  async getOwnVetClearanceRequests(userId: string, dto: GetVetClearanceDto) {
    // Validate user
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    // Validate vet
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId: user.id },
    });

    if (!vet) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User is not a vet');
    }

    // Pagination
    const { page, limit, skip } = this.utils.getPagination(dto);

    // Build query filters
    const where: Prisma.VetClearanceRequestWhereInput = {
      veterinarianId: vet.id,
    };

    if (dto.status) {
      where.status = dto.status;
    }

    // implement search by animal name or transport note
    if (dto.search) {
      where.OR = [
        {
          transports: {
            animal: { name: { contains: dto.search, mode: 'insensitive' } },
          },
        },
        {
          transports: {
            transportNote: { contains: dto.search, mode: 'insensitive' },
          },
        },
        {
          veterinarian: {
            user: {
              name: { contains: dto.search, mode: 'insensitive' },
              email: { contains: dto.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // Fetch data with transaction (data + total)
    const [clearances, total] = await this.prisma.client.$transaction([
      this.prisma.client.vetClearanceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transports: {
            include: {
              animal: true,
              shelter: true,
            },
          },
          veterinarian: { include: { user: true } },
        },
      }),
      this.prisma.client.vetClearanceRequest.count({ where }),
    ]);

    // Transform response
    const transformed = clearances.map((c) => ({
      id: c.id,
      animalId: c.transports?.animalId,
      vetClearance: c.vetClearance,
      status: c.status,
      veterinarianId: c.veterinarianId,
      veterinarianName: c.veterinarian?.user?.name ?? null,
      notFitReasons: c.notFitReasons,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      animalInfo: c.transports?.animal,
      shelterInfo: c.transports?.shelter,
      transPortDate: c.transports?.transPortDate,
      transPortTime: c.transports?.transPortTime,
      transport: c.transports
        ? {
            id: c.transports.id,
            transportNote: c.transports.transportNote,
            priorityLevel: c.transports.priorityLevel,
            status: c.transports.status,
            transPortDate: c.transports.transPortDate,
            transPortTime: c.transports.transPortTime,
          }
        : null,
    }));

    return successPaginatedResponse(
      transformed,
      { page, limit, total },
      'Vet clearance fetched successfully',
    );
  }

  @HandleError('Failed to get single vet clearance')
  async getSingleVetClearanceRequest(id: string) {
    const clearance = await this.prisma.client.vetClearanceRequest.findUnique({
      where: { id },
      include: {
        veterinarian: { include: { user: true } },
        transports: {
          include: {
            animal: true,
            shelter: true,
          },
        },
      },
    });

    if (!clearance) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Vet clearance not found');
    }

    const payload = {
      id: clearance.id,
      animalId: clearance.transports?.animalId,
      status: clearance.status,

      transPortDate: clearance.transports?.transPortDate ?? null,
      transPortTime: clearance.transports?.transPortTime ?? null,

      veterinarianName: clearance.veterinarian?.user?.name ?? null,

      transportNote: clearance.transports?.transportNote ?? null,

      animalName: clearance.transports?.animal?.name ?? null,
      animalBreed: clearance.transports?.animal?.breed ?? null,

      shelterName: clearance.transports?.shelter?.name ?? null,
    };

    return successResponse(payload, 'Vet clearance fetched successfully');
  }
}
