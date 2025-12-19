import { successPaginatedResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TransportStatus } from '@prisma';
import { DateTime } from 'luxon';
import { GetTransportDto, TransportDateFilter } from '../dto/get-transport.dto';

@Injectable()
export class GetTransportService {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(dto: GetTransportDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private applySearchFilter(
    where: Prisma.TransportWhereInput,
    search?: string,
  ) {
    if (!search) return;

    where.OR = [
      { transportNote: { contains: search, mode: 'insensitive' } },
      { animal: { name: { contains: search, mode: 'insensitive' } } },
      { animal: { breed: { contains: search, mode: 'insensitive' } } },
      { driver: { user: { name: { contains: search, mode: 'insensitive' } } } },
      { vet: { user: { name: { contains: search, mode: 'insensitive' } } } },
      { shelter: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  private applyDateFilter(
    where: Prisma.TransportWhereInput,
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
    }

    where.transPortDate = {
      gte: start.toJSDate(),
      lte: end.toJSDate(),
    };
  }

  private transformTransport(t: any) {
    return {
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
      shelterName: t.shelter?.name ?? null,
    };
  }

  private async getUserShelterId(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    return shelterId;
  }

  @HandleError("Can't get transports")
  async getTransports(userId: string, dto: GetTransportDto) {
    const shelterId = await this.getUserShelterId(userId);

    const { page, limit, skip } = this.getPagination(dto);
    const where: Prisma.TransportWhereInput = { shelterId };

    this.applySearchFilter(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

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

    return successPaginatedResponse(
      transports.map((t) => this.transformTransport(t)),
      { page, limit, total },
      'Transports fetched successfully',
    );
  }

  @HandleError("Can't get all active transports")
  async getAllActiveTransports(userId: string, dto: GetTransportDto) {
    const shelterId = await this.getUserShelterId(userId);

    const { page, limit, skip } = this.getPagination(dto);
    const where: Prisma.TransportWhereInput = {
      shelterId,
      status: { not: TransportStatus.COMPLETED },
    };

    this.applySearchFilter(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

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

    return successPaginatedResponse(
      transports.map((t) => this.transformTransport(t)),
      { page, limit, total },
      'Active transports fetched successfully',
    );
  }

  @HandleError("Can't get all transports")
  async getAllTransports(dto: GetTransportDto) {
    const { page, limit, skip } = this.getPagination(dto);
    const where: Prisma.TransportWhereInput = {};

    this.applySearchFilter(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

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
          shelter: true,
        },
      }),
      this.prisma.client.transport.count({ where }),
    ]);

    return successPaginatedResponse(
      transports.map((t) => this.transformTransport(t)),
      { page, limit, total },
      'All transports fetched successfully',
    );
  }
}
