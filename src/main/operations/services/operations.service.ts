import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma';
import { GetOperationEventsDto } from '../dto/get-operation-events.dto';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch operation events', 'Operations')
  async getOperationEvents(authUser: JWTPayload, dto: GetOperationEventsDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 20;
    const skip = (page - 1) * limit;

    const where = await this.buildScopedWhere(authUser, dto);

    const [events, total] = await this.prisma.client.$transaction([
      this.prisma.client.operationEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.operationEvent.count({ where }),
    ]);

    return successPaginatedResponse(
      events,
      { page, limit, total },
      'Operation events fetched',
    );
  }

  @HandleError('Failed to fetch operation event details', 'Operations')
  async getOperationEventById(authUser: JWTPayload, id: string) {
    const event = await this.prisma.client.operationEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Operation event not found');
    }

    if (!this.isAdmin(authUser.role)) {
      const user = await this.prisma.client.user.findUniqueOrThrow({
        where: { id: authUser.sub },
        select: { shelterAdminOfId: true, managerOfId: true },
      });
      const userShelterId = user.shelterAdminOfId ?? user.managerOfId;

      if (!userShelterId || event.shelterId !== userShelterId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'You are not allowed to access this event',
        );
      }
    }

    return successResponse(event, 'Operation event fetched');
  }

  private async buildScopedWhere(
    authUser: JWTPayload,
    dto: GetOperationEventsDto,
  ): Promise<Prisma.OperationEventWhereInput> {
    const where: Prisma.OperationEventWhereInput = {};

    if (dto.domain) where.domain = dto.domain;
    if (dto.status) where.status = dto.status;
    if (dto.action) where.action = dto.action;
    if (dto.correlationId) where.correlationId = dto.correlationId;
    if (dto.idempotencyKey) where.idempotencyKey = dto.idempotencyKey;
    if (dto.entityType) where.entityType = dto.entityType;
    if (dto.entityId) where.entityId = dto.entityId;

    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) where.createdAt.lte = new Date(dto.to);
    }

    if (this.isAdmin(authUser.role)) {
      if (dto.shelterId) where.shelterId = dto.shelterId;
      return where;
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: authUser.sub },
      select: { shelterAdminOfId: true, managerOfId: true },
    });
    const userShelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!userShelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'No shelter scope found for this user',
      );
    }

    where.shelterId = userShelterId;
    return where;
  }

  private isAdmin(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }
}
