import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { FosterInterestStatus, TransportStatus } from '@prisma';
import {
  CreateFosterAnimalInterestDto,
  ReviewFosterInterestDto,
} from '../dto/foster-animal.dto';

@Injectable()
export class ManageFosterAnimalInterestService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to submit foster interest')
  async expressInterest(
    userId: string,
    animalId: string,
    dto: CreateFosterAnimalInterestDto,
  ) {
    const foster = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { fosters: true },
    });

    if (!foster.fosters) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Foster profile not found');
    }

    if (foster.fosters.status !== 'APPROVED') {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Only approved fosters can express interest',
      );
    }

    this.validateAvailability(dto.availableFromTime, dto.availableUntilTime);

    const animal = await this.prisma.client.animal.findFirst({
      where: {
        id: animalId,
        status: 'AT_SHELTER',
        shelter: {
          status: 'APPROVED',
        },
      },
      include: {
        shelter: true,
        transports: {
          orderBy: { transPortDate: 'asc' },
          take: 1,
        },
      },
    });

    if (!animal || !animal.shelterId || !animal.shelter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Animal not available');
    }

    const existingInterest =
      await this.prisma.client.fosterAnimalInterest.findFirst({
        where: {
          fosterId: foster.fosters.id,
          animalId,
          status: {
            in: [
              FosterInterestStatus.INTERESTED,
              FosterInterestStatus.APPROVED,
            ],
          },
        },
      });

    if (existingInterest) {
      throw new AppError(
        HttpStatus.CONFLICT,
        'You have already expressed interest in this animal',
      );
    }

    const interest = await this.prisma.client.fosterAnimalInterest.create({
      data: {
        fosterId: foster.fosters.id,
        animalId: animal.id,
        shelterId: animal.shelterId,
        preferredArrivalDate: dto.preferredArrivalDate
          ? new Date(dto.preferredArrivalDate)
          : null,
        availableFromTime: dto.availableFromTime,
        availableUntilTime: dto.availableUntilTime,
        receivingAddress: foster.fosters.address,
        receivingPhone: foster.fosters.phone,
      },
      include: {
        animal: {
          include: {
            shelter: true,
            transports: {
              orderBy: { transPortDate: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    return successResponse(
      {
        id: interest.id,
        status: interest.status,
        preferredArrivalDate: interest.preferredArrivalDate,
        availableFromTime: interest.availableFromTime,
        availableUntilTime: interest.availableUntilTime,
        receivingDetails: {
          address: interest.receivingAddress,
          phone: interest.receivingPhone,
          estimatedTransportDate:
            interest.animal.transports[0]?.transPortDate ?? null,
        },
        animal: {
          id: interest.animal.id,
          name: interest.animal.name,
        },
        shelter: {
          id: interest.animal.shelter?.id ?? null,
          name: interest.animal.shelter?.name ?? null,
        },
      },
      'Interest confirmed successfully',
    );
  }

  @HandleError('Failed to review foster interest')
  async reviewInterest(
    userId: string,
    interestId: string,
    dto: ReviewFosterInterestDto,
  ) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Only shelter managers can review foster interest',
      );
    }

    const interest = await this.prisma.client.fosterAnimalInterest.findUnique({
      where: { id: interestId },
      include: {
        animal: {
          include: {
            transports: {
              orderBy: { transPortDate: 'desc' },
              take: 1,
            },
          },
        },
        foster: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!interest || interest.shelterId !== shelterId) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Foster interest not found');
    }

    if (interest.status !== FosterInterestStatus.INTERESTED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Only pending interests can be reviewed',
      );
    }

    const nextStatus = dto.approved
      ? FosterInterestStatus.APPROVED
      : FosterInterestStatus.REJECTED;

    if (dto.approved) {
      const existingApprovedRequest =
        await this.prisma.client.fosterAnimalInterest.findFirst({
          where: {
            animalId: interest.animalId,
            status: FosterInterestStatus.APPROVED,
            id: {
              not: interest.id,
            },
          },
        });

      if (existingApprovedRequest) {
        throw new AppError(
          HttpStatus.CONFLICT,
          'This animal already has an approved foster placement',
        );
      }
    }

    const updated = await this.prisma.client.fosterAnimalInterest.update({
      where: { id: interest.id },
      data: {
        status: nextStatus,
        reviewedAt: new Date(),
      },
      include: {
        animal: {
          include: {
            transports: {
              orderBy: { transPortDate: 'desc' },
              take: 1,
            },
          },
        },
        foster: {
          include: {
            user: true,
          },
        },
      },
    });

    return successResponse(
      {
        id: updated.id,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        foster: {
          id: updated.foster.id,
          name: updated.foster.user.name,
          phone: updated.receivingPhone,
          address: updated.receivingAddress,
        },
        animal: {
          id: updated.animal.id,
          name: updated.animal.name,
        },
        latestTransport: updated.animal.transports[0]
          ? {
              id: updated.animal.transports[0].id,
              date: updated.animal.transports[0].transPortDate,
              status: updated.animal.transports[0].status,
              isCompleted:
                updated.animal.transports[0].status ===
                TransportStatus.COMPLETED,
            }
          : null,
      },
      `Foster interest ${dto.approved ? 'approved' : 'rejected'} successfully`,
    );
  }

  private validateAvailability(from: string, until: string) {
    const start = this.toMinutes(from);
    const end = this.toMinutes(until);

    if (start === null || end === null) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Availability times must use a format like 11:00 am',
      );
    }

    if (start >= end) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Available from time must be earlier than available until time',
      );
    }
  }

  private toMinutes(value: string) {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);

    if (!match) {
      return null;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toLowerCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null;
    }

    if (meridiem === 'pm' && hour !== 12) {
      hour += 12;
    }

    if (meridiem === 'am' && hour === 12) {
      hour = 0;
    }

    return hour * 60 + minute;
  }
}
