import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { TransportDateFilter } from '@/main/transport/dto/get-transport.dto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, VetClearanceRequestStatus } from '@prisma';
import { DateTime } from 'luxon';
import { GetVetClearanceDto } from '../dto/vet-clearance.dto';

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
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, 'User not found');

    // Validate vet
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId: user.id },
    });
    if (!vet) throw new AppError(HttpStatus.NOT_FOUND, 'User is not a vet');

    // Pagination
    const { page, limit, skip } = this.utils.getPagination(dto);

    // Build query filters
    const where: Prisma.VetClearanceRequestWhereInput = {
      veterinarianId: vet.id,
    };

    if (dto.status) where.status = dto.status;

    // Search filter
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

    // Date filter (helper)
    this.applyDateFilter(where, dto.dateFilter);

    // Fetch data + total
    const [clearances, total] = await this.prisma.client.$transaction([
      this.prisma.client.vetClearanceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transports: { include: { animal: true, shelter: true } },
          veterinarian: { include: { user: true } },
        },
      }),
      this.prisma.client.vetClearanceRequest.count({ where }),
    ]);

    // Transform
    const transformed = clearances.map((c) => {
      const flags = this.getStatusFlags(c.status);
      return {
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
        ...flags,

        transport: c.transports
          ? {
              id: c.transports.id,
              transportNote: c.transports.transportNote,
              priorityLevel: c.transports.priorityLevel,
              status: c.transports.status,
              transPortDate: c.transports.transPortDate,
            }
          : null,
      };
    });

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

      veterinarianName: clearance.veterinarian?.user?.name ?? null,

      transportNote: clearance.transports?.transportNote ?? null,

      animalName: clearance.transports?.animal?.name ?? null,
      animalBreed: clearance.transports?.animal?.breed ?? null,

      shelterName: clearance.transports?.shelter?.name ?? null,

      ...this.getStatusFlags(clearance.status),
    };

    return successResponse(payload, 'Vet clearance fetched successfully');
  }

  private getStatusFlags(status: VetClearanceRequestStatus) {
    return {
      needsReview: status === 'PENDING_REVIEW',
      needsEvaluation: status === 'PENDING_EVALUATION',
      needsVisit: status === 'NEEDS_VISIT',
    };
  }

  private applyDateFilter(
    where: Prisma.VetClearanceRequestWhereInput,
    filter?: TransportDateFilter,
  ) {
    if (!filter || filter === TransportDateFilter.ALL) return;

    const now = DateTime.now();
    let start: DateTime;
    let end: DateTime;

    switch (filter) {
      case TransportDateFilter.TODAY:
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case TransportDateFilter.THIS_WEEK:
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case TransportDateFilter.LAST_WEEK:
        start = now.minus({ weeks: 1 }).startOf('week');
        end = now.minus({ weeks: 1 }).endOf('week');
        break;
      case TransportDateFilter.THIS_MONTH:
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case TransportDateFilter.LAST_MONTH:
        start = now.minus({ months: 1 }).startOf('month');
        end = now.minus({ months: 1 }).endOf('month');
        break;
      default:
        return;
    }

    where.transports = {
      transPortDate: { gte: start.toJSDate(), lte: end.toJSDate() },
    };
  }
}
