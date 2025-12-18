import { successPaginatedResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import { DateTime } from 'luxon';
import { GetTransportDto, TransportDateFilter } from '../dto/get-transport.dto';

@Injectable()
export class GetTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Can't get transports")
  async getTransports(userId: string, dto: GetTransportDto) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TransportWhereInput = { shelterId };

    // Search filter
    if (dto.search) {
      where.OR = [
        { transportNote: { contains: dto.search, mode: 'insensitive' } },
        { animal: { name: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    // Date filter
    if (dto.dateFilter && dto.dateFilter !== TransportDateFilter.ALL) {
      const now = DateTime.now();
      let start: DateTime, end: DateTime;

      switch (dto.dateFilter) {
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
      }

      where.transPortDate = { gte: start.toJSDate(), lte: end.toJSDate() };
    }

    // Fetch transports with related data
    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          animal: true,
          bondedPair: true,
          driver: { include: { user: true } },
          vet: { include: { user: true } },
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    // Transform to frontend-friendly structure
    const transformed = transports.map((t) => ({
      id: t.id,
      animalName: t.animal?.name ?? null,
      bondedPairName: t.bondedPair?.name ?? null,
      from: t.pickUpLocation,
      to: t.dropOffLocation,
      driverName: t.driver?.user?.name ?? null,
      driverPhone: t.driver?.phone ?? null,
      vetName: t.vet?.user?.name ?? null,
      priority: t.priorityLevel,
      status: t.status,
      vetClearanceRequired: t.isVetClearanceRequired,
      transportDate: t.transPortDate,
      transportTime: t.transPortTime,
    }));

    return successPaginatedResponse(
      transformed,
      { page, limit, total },
      'Transports fetched successfully',
    );
  }
}
