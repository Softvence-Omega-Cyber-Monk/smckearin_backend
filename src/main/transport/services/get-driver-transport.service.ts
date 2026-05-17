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

    const searchCondition: Prisma.TransportWhereInput = {
      OR: [
        { transportNote: { contains: search, mode: 'insensitive' } },
        {
          animals: {
            some: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          animals: {
            some: { breed: { contains: search, mode: 'insensitive' } },
          },
        },
        { vet: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { shelter: { name: { contains: search, mode: 'insensitive' } } },
        {
          driver: {
            user: { name: { contains: search, mode: 'insensitive' } },
          },
        },
      ],
    };

    if (where.AND) {
      if (Array.isArray(where.AND)) {
        where.AND.push(searchCondition);
      } else {
        where.AND = [where.AND as any, searchCondition];
      }
    } else {
      where.AND = [searchCondition];
    }
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

  private formatTransport(
    t: any,
    driverId?: string,
    locationParams?: {
      latMin: number;
      latMax: number;
      lonMin: number;
      lonMax: number;
    },
  ) {
    let pickUpLocation = t.pickUpLocation;
    let dropOffLocation = t.dropOffLocation;
    let status = t.status;
    const isMultiLeg = t.isMultiLeg || false;
    let legsData: any[] = [];

    if (isMultiLeg && t.legs) {
      let myLeg: any = null;

      if (driverId) {
        myLeg = t.legs.find((leg: any) => leg.driverId === driverId);
      }

      if (!myLeg && locationParams) {
        const { latMin, latMax, lonMin, lonMax } = locationParams;
        myLeg = t.legs.find(
          (leg: any) =>
            !leg.driverId &&
            ['PENDING', 'SCHEDULED'].includes(leg.status) &&
            leg.pickUpLatitude >= latMin &&
            leg.pickUpLatitude <= latMax &&
            leg.pickUpLongitude >= lonMin &&
            leg.pickUpLongitude <= lonMax,
        );
      }

      // Fallback
      if (!myLeg) {
        myLeg = t.legs.find(
          (leg: any) =>
            !leg.driverId && ['PENDING', 'SCHEDULED'].includes(leg.status),
        );
      }

      if (myLeg) {
        pickUpLocation = myLeg.pickUpLocation;
        dropOffLocation = myLeg.dropOffLocation;
        status = myLeg.status;
        legsData = [
          {
            id: myLeg.id,
            sequenceOrder: myLeg.sequenceOrder,
            status: myLeg.status,
            pickUp: {
              location: myLeg.pickUpLocation,
              latitude: myLeg.pickUpLatitude,
              longitude: myLeg.pickUpLongitude,
            },
            dropOff: {
              location: myLeg.dropOffLocation,
              latitude: myLeg.dropOffLatitude,
              longitude: myLeg.dropOffLongitude,
            },
            driver: myLeg.driver
              ? {
                  id: myLeg.driver.id,
                  name: myLeg.driver.user?.name ?? null,
                  email: myLeg.driver.user?.email ?? null,
                  profilePictureUrl:
                    myLeg.driver.user?.profilePictureUrl ?? null,
                }
              : null,
            actualPickUpAt: myLeg.actualPickUpAt,
            actualDropOffAt: myLeg.actualDropOffAt,
            createdAt: myLeg.createdAt,
            updatedAt: myLeg.updatedAt,
          },
        ];
      }
    }

    return {
      id: t.id,
      animalName:
        t.animals && t.animals.length > 0
          ? t.animals.map((a: any) => `${a.name} (${a.breed})`)
          : [],
      pickUpLocation,
      dropOffLocation,
      priority: t.priorityLevel,
      transportNote: t.transportNote,
      status,
      transportDate: t.transPortDate,
      isMultiLeg,
      legs: legsData,
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
      OR: [
        {
          isMultiLeg: false,
          OR: [{ driverId: null }, { driverId: driver.id }],
          status: { in: [TransportStatus.PENDING, TransportStatus.SCHEDULED] },
          pickUpLatitude: {
            gte: latitude - deltaLat,
            lte: latitude + deltaLat,
          },
          pickUpLongitude: {
            gte: longitude - deltaLon,
            lte: longitude + deltaLon,
          },
        },
        {
          isMultiLeg: true,
          legs: {
            some: {
              OR: [{ driverId: null }, { driverId: driver.id }],
              status: { in: ['PENDING', 'SCHEDULED'] },
              pickUpLatitude: {
                gte: latitude - deltaLat,
                lte: latitude + deltaLat,
              },
              pickUpLongitude: {
                gte: longitude - deltaLon,
                lte: longitude + deltaLon,
              },
            },
          },
        },
      ],
    };

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          animals: true,
          legs: { include: { driver: { include: { user: true } } } },
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    const locationParams = {
      latMin: latitude - deltaLat,
      latMax: latitude + deltaLat,
      lonMin: longitude - deltaLon,
      lonMax: longitude + deltaLon,
    };

    return successPaginatedResponse(
      transports.map((t) => this.formatTransport(t, driver.id, locationParams)),
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
      OR: [
        {
          driverId: driver.id,
          status: {
            in: [
              TransportStatus.ACCEPTED,
              TransportStatus.PICKED_UP,
              TransportStatus.IN_TRANSIT,
            ],
          },
        },
        {
          isMultiLeg: true,
          status: {
            in: [
              TransportStatus.ACCEPTED,
              TransportStatus.PICKED_UP,
              TransportStatus.IN_TRANSIT,
            ],
          },
          legs: {
            some: {
              driverId: driver.id,
              status: {
                in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'],
              },
            },
          },
        },
      ],
    };

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          animals: true,
          legs: { include: { driver: { include: { user: true } } } },
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map((t) => this.formatTransport(t, driver.id)),
      { page, limit, total },
      'Active transports fetched',
    );
  }

  @HandleError("Can't get assigned transport")
  async getAssignedTransportOfDriver(userId: string, dto: GetTransportDto) {
    const driver = await this.prisma.client.driver.findUniqueOrThrow({
      where: { userId },
    });

    const { page, limit, skip } = this.getPagination(dto);

    const where: Prisma.TransportWhereInput = {
      OR: [
        {
          driverId: driver.id,
          status: { in: [TransportStatus.PENDING, TransportStatus.SCHEDULED] },
        },
        {
          isMultiLeg: true,
          status: { in: [TransportStatus.PENDING, TransportStatus.SCHEDULED] },
          legs: {
            some: {
              driverId: driver.id,
              status: { in: ['PENDING', 'ASSIGNED'] },
            },
          },
        },
      ],
    };

    this.applySearch(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [transports, total] = await this.prisma.client.$transaction([
      this.prisma.client.transport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          animals: true,
          legs: { include: { driver: { include: { user: true } } } },
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map((t) => this.formatTransport(t, driver.id)),
      { page, limit, total },
      'Assigned transports fetched',
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
      OR: [
        { driverId: driver.id },
        {
          isMultiLeg: true,
          legs: {
            some: { driverId: driver.id },
          },
        },
      ],
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
          animals: true,
          legs: { include: { driver: { include: { user: true } } } },
          vet: { include: { user: true } },
          shelter: true,
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map((t) => this.formatTransport(t, driver.id)),
      { page, limit, total },
      'Driver transport history fetched',
    );
  }
}
