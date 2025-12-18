import { successPaginatedResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma, TransportStatus } from '@prisma';
import { DateTime } from 'luxon';
import {
  GetTransportByLocationDto,
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

    const where: Prisma.TransportWhereInput = {
      OR: [{ driverId: null }, { driverId: driver.id }],
      status: { in: [TransportStatus.PENDING] },
    };

    // Search filter
    if (dto.search) {
      where.OR = [
        { transportNote: { contains: dto.search, mode: 'insensitive' } },
        { animal: { name: { contains: dto.search, mode: 'insensitive' } } },
        {
          animal: { breed: { contains: dto.search, mode: 'insensitive' } },
        },
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

      where.transPortDate = { gte: start.toJSDate(), lte: end.toJSDate() };
    }

    const [transports] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { animal: true },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    const filtered = transports.filter((t) => {
      const distance = this.getDistanceKm(
        latitude,
        longitude,
        t.pickUpLatitude,
        t.pickUpLongitude,
      );
      return distance <= radiusKm;
    });

    const formatted = filtered.map((t) => ({
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
      { page, limit, total: filtered.length },
      'Transports fetched',
    );
  }

  private getDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
