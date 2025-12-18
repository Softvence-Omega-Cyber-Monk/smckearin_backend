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

  @HandleError("Can't get transport")
  async getUnAssignedOrSelfAssignedTransport(
    userId: string,
    dto: GetTransportByLocationDto,
  ) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const { latitude, longitude, radiusKm } = dto;
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    // Bounding box for approximate radius filtering
    const deltaLat = radiusKm / 111; // ~111 km per latitude degree
    const deltaLon = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const where: Prisma.TransportWhereInput = {
      OR: [{ driverId: null }, { driverId: driver.id }],
      status: { in: [TransportStatus.PENDING] },
      pickUpLatitude: { gte: latitude - deltaLat, lte: latitude + deltaLat },
      pickUpLongitude: { gte: longitude - deltaLon, lte: longitude + deltaLon },
    };

    // Search filter
    if (dto.search) {
      where.OR = [
        ...(where.OR as any),
        { transportNote: { contains: dto.search, mode: 'insensitive' } },
        { animal: { name: { contains: dto.search, mode: 'insensitive' } } },
        { animal: { breed: { contains: dto.search, mode: 'insensitive' } } },
        {
          driver: {
            user: { name: { contains: dto.search, mode: 'insensitive' } },
          },
        },
        {
          vet: {
            user: { name: { contains: dto.search, mode: 'insensitive' } },
          },
        },
        { shelter: { name: { contains: dto.search, mode: 'insensitive' } } },
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

      if (start && end)
        where.transPortDate = { gte: start.toJSDate(), lte: end.toJSDate() };
    }

    // Fetch paginated transports from DB (already filtered by bounding box)
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

    const formatted = transports.map((t) => ({
      id: t.id,
      animalName: t.animal ? `${t.animal.name} (${t.animal.breed})` : null,
      pickUpLocation: t.pickUpLocation,
      dropOffLocation: t.dropOffLocation,
      priority: t.priorityLevel,
      transportNote: t.transportNote,
      status: t.status,
    }));

    return successPaginatedResponse(
      formatted,
      { page, limit, total },
      'Transports fetched',
    );
  }

  @HandleError("Can't get transport")
  async getActiveTransportOfDriver(userId: string, dto: GetTransportDto) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

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

    // Search filter
    if (dto.search) {
      where.OR = [
        { transportNote: { contains: dto.search, mode: 'insensitive' } },
        { animal: { name: { contains: dto.search, mode: 'insensitive' } } },
        { animal: { breed: { contains: dto.search, mode: 'insensitive' } } },
        {
          vet: {
            user: { name: { contains: dto.search, mode: 'insensitive' } },
          },
        },
        { shelter: { name: { contains: dto.search, mode: 'insensitive' } } },
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

      if (start && end) {
        where.transPortDate = {
          gte: start.toJSDate(),
          lte: end.toJSDate(),
        };
      }
    }

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

    const formatted = transports.map((t) => ({
      id: t.id,
      animalName: t.animal ? `${t.animal.name} (${t.animal.breed})` : null,
      pickUpLocation: t.pickUpLocation,
      dropOffLocation: t.dropOffLocation,
      priority: t.priorityLevel,
      transportNote: t.transportNote,
      status: t.status,
    }));

    return successPaginatedResponse(
      formatted,
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

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TransportWhereInput = {
      driverId: driver.id,
    };

    // Status filter
    if (dto.status) {
      where.status = dto.status;
    }

    // Search filter
    if (dto.search) {
      where.OR = [
        { transportNote: { contains: dto.search, mode: 'insensitive' } },
        { animal: { name: { contains: dto.search, mode: 'insensitive' } } },
        { animal: { breed: { contains: dto.search, mode: 'insensitive' } } },
        {
          vet: {
            user: { name: { contains: dto.search, mode: 'insensitive' } },
          },
        },
        { shelter: { name: { contains: dto.search, mode: 'insensitive' } } },
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

      where.transPortDate = {
        gte: start.toJSDate(),
        lte: end.toJSDate(),
      };
    }

    // Query
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

    const formatted = transports.map((t) => ({
      id: t.id,
      animalName: t.animal ? `${t.animal.name} (${t.animal.breed})` : null,
      pickUpLocation: t.pickUpLocation,
      dropOffLocation: t.dropOffLocation,
      priority: t.priorityLevel,
      transportNote: t.transportNote,
      status: t.status,
      transportDate: t.transPortDate,
    }));

    return successPaginatedResponse(
      formatted,
      { page, limit, total },
      'Driver transport history fetched',
    );
  }
}
