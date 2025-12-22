import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import {
  GetTransportDto,
  TransportDateFilter,
} from '@/main/transport/dto/get-transport.dto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, VetAppointmentStatus } from '@prisma';
import { DateTime } from 'luxon';

@Injectable()
export class VetAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  private applySearchFilter(
    where: Prisma.VetAppointmentWhereInput,
    search?: string,
  ) {
    if (!search) return;

    where.OR = [
      // search vet name
      {
        veterinarian: {
          user: { name: { contains: search, mode: 'insensitive' } },
        },
      },
      // search animal name
      {
        request: {
          transports: {
            animal: { name: { contains: search, mode: 'insensitive' } },
          },
        },
      },
      // search shelter name
      {
        request: {
          transports: {
            shelter: { name: { contains: search, mode: 'insensitive' } },
          },
        },
      },
      // search location
      {
        location: { contains: search, mode: 'insensitive' },
      },
      // search requestId
      {
        requestId: { equals: search },
      },
    ];
  }

  private applyDateFilter(
    where: Prisma.VetAppointmentWhereInput,
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

    where.appointmentDate = {
      gte: start.toJSDate(),
      lte: end.toJSDate(),
    };
  }

  @HandleError('Failed to get vet appointments')
  async getOwnVetAppointments(userId: string, dto: GetTransportDto) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet)
      throw new AppError(HttpStatus.NOT_FOUND, 'User is not a veterinarian');

    const { page, limit, skip } = this.utils.getPagination(dto);

    const where: Prisma.VetAppointmentWhereInput = {
      veterinarianId: vet.id,
    };

    this.applySearchFilter(where, dto.search);
    this.applyDateFilter(where, dto.dateFilter);

    const [appointments, total] = await this.prisma.client.$transaction([
      this.prisma.client.vetAppointment.findMany({
        where,
        skip,
        take: limit,
        include: {
          request: {
            include: {
              transports: {
                include: {
                  animal: true,
                  shelter: true,
                },
              },
            },
          },
        },
        orderBy: { appointmentDate: 'desc' },
      }),
      this.prisma.client.vetAppointment.count({ where }),
    ]);

    const transformed = appointments.map((apt) => ({
      id: apt.id,
      appointmentDate: apt.appointmentDate,
      transportDate: apt.request?.transports?.transPortDate,
      status: apt.status,
      location: apt.location,
      latitude: apt.latitude,
      longitude: apt.longitude,
      notes: apt.notes,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,

      animalInfo: apt.request?.transports?.animal,
      shelterInfo: apt.request?.transports?.shelter,
      transportInfo: apt.request?.transports,
      requestId: apt.requestId,
    }));

    return successPaginatedResponse(
      transformed,
      { page, limit, total },
      'Appointments fetched successfully',
    );
  }

  @HandleError('Failed to get appointment')
  async getSingleAppointment(userId: string, appointmentId: string) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet)
      throw new AppError(HttpStatus.NOT_FOUND, 'User is not a veterinarian');

    const appointment = await this.prisma.client.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        request: {
          include: {
            transports: {
              include: { animal: true, shelter: true },
            },
            veterinarian: { include: { user: true } },
          },
        },
      },
    });

    if (!appointment)
      throw new AppError(HttpStatus.NOT_FOUND, 'Appointment not found');

    if (appointment.veterinarianId !== vet.id)
      throw new AppError(HttpStatus.FORBIDDEN, 'Not your appointment');

    const t = appointment.request?.transports;

    const transformed = {
      id: appointment.id,
      appointmentDate: appointment.appointmentDate,
      transportDate: t?.transPortDate,
      status: appointment.status,
      location: appointment.location,
      latitude: appointment.latitude,
      longitude: appointment.longitude,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,

      animalInfo: t?.animal || null,
      shelterInfo: t?.shelter || null,
      transportInfo: t || null,

      requestId: appointment.requestId,
    };

    return successResponse(transformed, 'Appointment fetched successfully');
  }

  @HandleError('Failed to load appointment stats')
  async getVetAppointmentStats(userId: string, timezone?: string) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User is not a veterinarian');
    }

    const defaultTz = 'America/New_York';
    const appliedTz = timezone || defaultTz;

    const tzCheck = DateTime.now().setZone(appliedTz);

    if (!tzCheck.isValid) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Invalid timezone: "${appliedTz}". Please send a valid IANA timezone (e.g. "Asia/Dhaka", "Europe/London")`,
      );
    }

    const now = tzCheck;

    const startOfToday = now.startOf('day').toUTC().toJSDate();
    const endOfToday = now.endOf('day').toUTC().toJSDate();

    const todayAppointments = await this.prisma.client.vetAppointment.count({
      where: {
        veterinarianId: vet.id,
        appointmentDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    const upcomingAppointments = await this.prisma.client.vetAppointment.count({
      where: {
        veterinarianId: vet.id,
        appointmentDate: {
          gt: endOfToday,
        },
        status: {
          in: [VetAppointmentStatus.SCHEDULED],
        },
      },
    });

    const totalAppointments = await this.prisma.client.vetAppointment.count({
      where: { veterinarianId: vet.id },
    });

    const completedAppointments = await this.prisma.client.vetAppointment.count(
      {
        where: {
          veterinarianId: vet.id,
          status: VetAppointmentStatus.COMPLETED,
        },
      },
    );

    return successResponse(
      {
        timezoneUsed: appliedTz,
        todayRangeUTC: {
          startOfToday,
          endOfToday,
        },
        todayAppointments,
        upcomingAppointments,
        totalAppointments,
        completedAppointments,
      },
      'Vet appointment stats fetched successfully',
    );
  }
}
