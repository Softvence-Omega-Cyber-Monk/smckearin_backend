import { successPaginatedResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma, TransportStatus } from '@prisma';
import { DateTime } from 'luxon';
import {
  GetAllTransportHistory,
  GetTransportByLocationDto,
  GetTransportDto,
  TransportDateFilter,
} from '../dto/get-transport.dto';

@Injectable()
export class GetDriverTransportService {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(dto: { page?: number; limit?: number }) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    return { page, limit, skip: (page - 1) * limit };
  }

  private applySearch(where: Prisma.TransportWhereInput, search?: string) {
    if (!search) return;

    where.OR = [
      { transportNote: { contains: search, mode: 'insensitive' } },
      { animal: { name: { contains: search, mode: 'insensitive' } } },
      { animal: { breed: { contains: search, mode: 'insensitive' } } },
      { vet: { user: { name: { contains: search, mode: 'insensitive' } } } },
      { shelter: { name: { contains: search, mode: 'insensitive' } } },
      {
        driver: {
          user: { name: { contains: search, mode: 'insensitive' } },
        },
      },
    ];
  }

  private applyDateFilter(
    where: Prisma.TransportWhereInput,
    dateFilter?: TransportDateFilter,
  ) {
    if (!dateFilter || dateFilter === TransportDateFilter.ALL) return;

    const now = DateTime.now();
    let start: DateTime;
    let end: DateTime;

    switch (dateFilter) {
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

    where.transPortDate = {
      gte: start.toJSDate(),
      lte: end.toJSDate(),
    };
  }

  private formatTransport(t: any) {
    return {
      id: t.id,
      animalName: t.animal ? `${t.animal.name} (${t.animal.breed})` : null,
      pickUpLocation: t.pickUpLocation,
      dropOffLocation: t.dropOffLocation,
      priority: t.priorityLevel,
      transportNote: t.transportNote,
      status: t.status,
      transportDate: t.transPortDate,
    };
  }

  @HandleError("Can't get transport")
  async getUnAssignedOrSelfAssignedTransport(
    userId: string,
    dto: GetTransportByLocationDto,
  ) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const { latitude, longitude, radiusKm } = dto;
    const { page, limit, skip } = this.getPagination(dto);

    const deltaLat = radiusKm / 111;
    const deltaLon = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const where: Prisma.TransportWhereInput = {
      OR: [{ driverId: null }, { driverId: driver.id }],
      status: { in: [TransportStatus.PENDING] },
      pickUpLatitude: { gte: latitude - deltaLat, lte: latitude + deltaLat },
      pickUpLongitude: { gte: longitude - deltaLon, lte: longitude + deltaLon },
    };

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { animal: true },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map(this.formatTransport),
      { page, limit, total },
      'Transports fetched',
    );
  }

  @HandleError("Can't get transport")
  async getActiveTransportOfDriver(userId: string, dto: GetTransportDto) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const { page, limit, skip } = this.getPagination(dto);

    const where: Prisma.TransportWhereInput = {
      driverId: driver.id,
      status: {
        in: [
          TransportStatus.ACCEPTED,
          TransportStatus.PICKED_UP,
          TransportStatus.IN_TRANSIT,
        ],
      },
    };

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { animal: true },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map(this.formatTransport),
      { page, limit, total },
      'Active transports fetched',
    );
  }

  @HandleError("Can't get driver transport history")
  async getAllDriverTransportHistory(
    userId: string,
    dto: GetAllTransportHistory,
  ) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const { page, limit, skip } = this.getPagination(dto);

    const where: Prisma.TransportWhereInput = {
      driverId: driver.id,
    };

    if (dto.status) {
      where.status = dto.status;
    }

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transPortDate: 'desc' },
        include: {
          animal: true,
          vet: { include: { user: true } },
          shelter: true,
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map(this.formatTransport),
      { page, limit, total },
      'Driver transport history fetched',
    );
  }
}
