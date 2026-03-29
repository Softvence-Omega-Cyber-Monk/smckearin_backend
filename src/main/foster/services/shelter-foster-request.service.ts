import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UserNotificationService } from '@/lib/queue/services/user-notification.service';
import { TrackingDataService } from '@/lib/queue/trip/tracking-data.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FosterInterestStatus,
  FosterRequestStatus,
  Prisma,
  PriorityLevel,
  TransportStatus,
} from '@prisma';
import {
  CancelShelterFosterRequestDto,
  CreateFosterTransportDto,
  CreateShelterFosterRequestDto,
  GetShelterFosterRequestsDto,
  UpdateShelterFosterRequestDto,
} from '../dto/foster-request.dto';
const ACTIVE_STATUSES: FosterRequestStatus[] = [
  FosterRequestStatus.REQUESTED,
  FosterRequestStatus.INTERESTED,
  FosterRequestStatus.APPROVED,
  FosterRequestStatus.SCHEDULED,
];

@Injectable()
export class ShelterFosterRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly trackingDataService: TrackingDataService,
    private readonly userNotificationService: UserNotificationService,
  ) {}

  @HandleError('Failed to get foster requests')
  async getShelterFosterRequests(
    userId: string,
    dto: GetShelterFosterRequestsDto,
  ) {
    const shelterId = await this.getShelterId(userId);
    const filter = dto.status?.toUpperCase() || 'ALL';

    const [requests, interests] = await Promise.all([
      this.prisma.client.fosterRequest.findMany({
        where: {
          shelterId,
          ...(dto.search
            ? {
                animal: { name: { contains: dto.search, mode: 'insensitive' } },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: this.listInclude,
      }),
      this.prisma.client.fosterAnimalInterest.findMany({
        where: {
          shelterId,
          ...(dto.search
            ? {
                animal: { name: { contains: dto.search, mode: 'insensitive' } },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: this.listInterestInclude,
      }),
    ]);

    const mappedRequests = requests.map((item) => this.formatListItem(item));
    const mappedInterests = interests.map((item) =>
      this.formatInterestListItem(item),
    );

    const all = [...mappedRequests, ...mappedInterests].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const filtered = this.filterByStatus(all, filter);

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    return {
      success: true,
      total: filtered.length,
      sectionLabel: `${filter.charAt(0) + filter.slice(1).toLowerCase()} fosters`,
      data: filtered.slice(skip, skip + limit),
    };
  }

  private filterByStatus(items: any[], filter: string) {
    if (filter === 'ALL') return items;

    return items.filter((item) => {
      const status = item.status.toUpperCase();
      const interestStatus = item.interestStatus?.toUpperCase();

      switch (filter) {
        case 'REQUESTS':
          return status === 'REQUESTED' && !item.interestId;
        case 'INTERESTED':
          return status === 'INTERESTED' || interestStatus === 'INTERESTED';
        case 'APPROVED':
          return status === 'APPROVED' || interestStatus === 'APPROVED';
        case 'SCHEDULED':
          return (
            status === 'SCHEDULED' ||
            status === 'PICKED_UP' ||
            status === 'IN_TRANSIT'
          );
        case 'COMPLETED':
          return status === 'DELIVERED' || interestStatus === 'COMPLETED';
        case 'CANCELLED':
          return (
            status === 'CANCELLED' ||
            interestStatus === 'REJECTED' ||
            interestStatus === 'WITHDRAWN'
          );
        default:
          return true;
      }
    });
  }

  @HandleError('Failed to get foster placement stats')
  async getFosterPlacementStats(userId: string) {
    const shelterId = await this.getShelterId(userId);

    const [availableAnimals, pendingRequests] = await Promise.all([
      this.prisma.client.animal.count({
        where: {
          shelterId,
          status: 'AT_SHELTER',
        },
      }),
      this.prisma.client.fosterRequest.count({
        where: {
          shelterId,
          status: {
            in: [FosterRequestStatus.REQUESTED, FosterRequestStatus.INTERESTED],
          },
        },
      }),
    ]);

    return successResponse(
      {
        availableAnimals,
        pendingRequests,
      },
      'Foster placement stats fetched successfully',
    );
  }

  @HandleError('Failed to get recently completed placements')
  async getShelterRecentlyCompletedPlacements(userId: string) {
    const shelterId = await this.getShelterId(userId);

    const requests = await this.prisma.client.fosterRequest.findMany({
      where: {
        shelterId,
        status: FosterRequestStatus.DELIVERED,
      },
      take: 5,
      orderBy: { deliveryTime: 'desc' },
      include: {
        animal: true,
        transport: true,
        fosterUser: true,
      },
    });

    return successResponse(
      requests.map((request) => ({
        id: request.id,
        animal: {
          id: request.animal.id,
          name: request.animal.name,
          breed: request.animal.breed,
          imageUrl: request.animal.imageUrl,
        },
        tripId: request.transportId
          ? `Tr-${request.transportId.substring(0, 3).toUpperCase()}`
          : null,
        status: 'Delivered',
        pickupLocation: request.transport?.pickUpLocation ?? 'Unknown',
        dropoffLocation: request.transport?.dropOffLocation ?? 'Unknown',
        deliveryTime: request.deliveryTime,
        formatDeliveryDate: this.formatDateTime(request.deliveryTime),
      })),
      'Recently completed foster placements fetched successfully',
    );
  }

  @HandleError('Failed to get foster request counts')
  async getShelterFosterRequestCounts(userId: string) {
    const shelterId = await this.getShelterId(userId);
    const grouped = await this.prisma.client.fosterRequest.groupBy({
      by: ['status'],
      where: { shelterId },
      _count: { status: true },
    });

    const counts = {
      requested: 0,
      interested: 0,
      approved: 0,
      scheduled: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const row of grouped) {
      counts[this.toClientStatus(row.status)] = row._count.status;
    }

    return successResponse(
      counts,
      'Foster request counts fetched successfully',
    );
  }

  @HandleError('Failed to create foster request')
  async createShelterFosterRequest(
    userId: string,
    dto: CreateShelterFosterRequestDto,
  ) {
    const shelterId = await this.getShelterId(userId);
    this.validateCreatePayload();

    const animalIds = [
      ...new Set([dto.animalId, ...(dto.additionalAnimalIds ?? [])]),
    ];

    const created = await this.prisma.client.$transaction(async (tx) => {
      const records = [];

      for (const animalId of animalIds) {
        await this.validateShelterAnimal(tx, shelterId, animalId);
        await this.ensureAnimalHasNoActiveRequest(tx, animalId);

        const record = await tx.fosterRequest.create({
          data: {
            animalId,
            shelterId,
            requestedAt: new Date(),
            estimateTransportDate: new Date(dto.estimateTransportDate),
            estimateTransportTimeStart: dto.estimateTransportTimeStart,
            estimateTransportTimeEnd: dto.estimateTransportTimeEnd,
            spayNeuterAvailable: dto.spayNeuterAvailable,
            spayNeuterDate: this.asDate(dto.spayNeuterDate),
            spayNeuterNextDate: this.asDate(dto.spayNeuterNextDate),
            lastCheckupDate: this.asDate(dto.lastCheckupDate),
            vaccinationsDate: this.asDate(dto.vaccinationsDate),
            petPersonality: dto.petPersonality,
            shelterNote: dto.specialNote,
          },
          include: this.detailInclude,
        });

        records.push(record);
      }

      return records;
    });

    await Promise.all(
      created.map((request) =>
        this.userNotificationService.notifyFosterRequestEvent(
          'CREATED',
          request.id,
        ),
      ),
    );

    return successResponse(
      await Promise.all(created.map((request) => this.formatDetail(request))),
      created.length === 1
        ? 'Foster request created successfully'
        : 'Foster requests created successfully',
    );
  }

  @HandleError('Failed to get foster request')
  async getShelterFosterRequest(userId: string, fosterRequestId: string) {
    const request = await this.getOwnedRequest(userId, fosterRequestId);
    return successResponse(
      await this.formatDetail(request),
      'Foster request fetched successfully',
    );
  }

  @HandleError('Failed to update foster request')
  async updateShelterFosterRequest(
    userId: string,
    fosterRequestId: string,
    dto: UpdateShelterFosterRequestDto,
  ) {
    const shelterId = await this.getShelterId(userId);
    const existing = await this.prisma.client.fosterRequest.findFirst({
      where: { id: fosterRequestId, shelterId },
    });

    if (!existing) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Foster request not found');
    }

    if (existing.status !== FosterRequestStatus.REQUESTED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Only requested foster requests can be edited',
      );
    }

    this.validateUpdatePayload();

    const updated = await this.prisma.client.$transaction(async (tx) => {
      let animalId = existing.animalId;

      if (dto.animalId && dto.animalId !== existing.animalId) {
        await this.validateShelterAnimal(tx, shelterId, dto.animalId);
        await this.ensureAnimalHasNoActiveRequest(
          tx,
          dto.animalId,
          existing.id,
        );
        animalId = dto.animalId;
      }

      return tx.fosterRequest.update({
        where: { id: existing.id },
        data: {
          animalId,
          estimateTransportDate:
            dto.estimateTransportDate === undefined
              ? existing.estimateTransportDate
              : new Date(dto.estimateTransportDate),
          estimateTransportTimeStart:
            dto.estimateTransportTimeStart ??
            existing.estimateTransportTimeStart,
          estimateTransportTimeEnd:
            dto.estimateTransportTimeEnd ?? existing.estimateTransportTimeEnd,
          spayNeuterAvailable:
            dto.spayNeuterAvailable ?? existing.spayNeuterAvailable,
          spayNeuterDate:
            dto.spayNeuterDate === undefined
              ? existing.spayNeuterDate
              : this.asDate(dto.spayNeuterDate),
          spayNeuterNextDate:
            dto.spayNeuterNextDate === undefined
              ? existing.spayNeuterNextDate
              : this.asDate(dto.spayNeuterNextDate),
          lastCheckupDate:
            dto.lastCheckupDate === undefined
              ? existing.lastCheckupDate
              : this.asDate(dto.lastCheckupDate),
          vaccinationsDate:
            dto.vaccinationsDate === undefined
              ? existing.vaccinationsDate
              : this.asDate(dto.vaccinationsDate),
          petPersonality: dto.petPersonality ?? existing.petPersonality,
          shelterNote: dto.specialNote ?? existing.shelterNote,
        },
        include: this.detailInclude,
      });
    });

    return successResponse(
      await this.formatDetail(updated),
      'Foster request updated successfully',
    );
  }

  @HandleError('Failed to cancel foster request')
  async cancelShelterFosterRequest(
    userId: string,
    fosterRequestId: string,
    dto: CancelShelterFosterRequestDto,
  ) {
    const existing = await this.getOwnedRequest(userId, fosterRequestId);

    if (existing.status === FosterRequestStatus.DELIVERED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Delivered foster requests cannot be cancelled',
      );
    }

    if (existing.status === FosterRequestStatus.CANCELLED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Foster request is already cancelled',
      );
    }

    if (
      existing.status !== FosterRequestStatus.REQUESTED &&
      existing.status !== FosterRequestStatus.SCHEDULED
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Only requested or scheduled foster requests can be cancelled',
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (existing.transportId) {
        await tx.transport.update({
          where: { id: existing.transportId },
          data: { status: TransportStatus.CANCELLED },
        });

        await tx.transportTimeline.create({
          data: {
            transportId: existing.transportId,
            status: TransportStatus.CANCELLED,
            note: dto.cancelReason || 'Transport cancelled from foster request',
          },
        });

        await tx.animal.update({
          where: { id: existing.animalId },
          data: { status: 'AT_SHELTER' },
        });
      }

      return tx.fosterRequest.update({
        where: { id: existing.id },
        data: {
          status: FosterRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.cancelReason,
        },
        include: this.detailInclude,
      });
    });

    await this.userNotificationService.notifyFosterRequestEvent(
      'CANCELLED',
      updated.id,
    );

    return successResponse(
      await this.formatDetail(updated),
      'Foster request cancelled successfully',
    );
  }

  @HandleError('Failed to approve foster request')
  async approveShelterFosterRequest(userId: string, fosterRequestId: string) {
    const existing = await this.getOwnedRequest(userId, fosterRequestId);

    if (existing.status !== FosterRequestStatus.INTERESTED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Only interested foster requests can be approved',
      );
    }

    if (!existing.fosterUserId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Interested foster request must have a foster user assigned',
      );
    }

    const updated = await this.prisma.client.fosterRequest.update({
      where: { id: existing.id },
      data: { status: FosterRequestStatus.APPROVED },
      include: this.detailInclude,
    });

    await this.userNotificationService.notifyFosterRequestEvent(
      'APPROVED',
      updated.id,
    );

    return successResponse(
      await this.formatDetail(updated),
      'Foster request approved successfully',
    );
  }

  @HandleError('Failed to decline foster request')
  async declineShelterFosterRequest(userId: string, fosterRequestId: string) {
    const existing = await this.getOwnedRequest(userId, fosterRequestId);

    if (existing.status !== FosterRequestStatus.INTERESTED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Only interested foster requests can be declined',
      );
    }

    const updated = await this.prisma.client.fosterRequest.update({
      where: { id: existing.id },
      data: {
        status: FosterRequestStatus.REQUESTED,
        fosterUserId: null,
      },
      include: this.detailInclude,
    });

    await this.userNotificationService.notifyFosterRequestEvent(
      'DECLINED',
      updated.id,
    );

    return successResponse(
      await this.formatDetail(updated),
      'Foster request declined successfully',
    );
  }

  @HandleError('Failed to create foster transport')
  async createTransportForFosterRequest(
    userId: string,
    fosterRequestId: string,
    dto: CreateFosterTransportDto,
  ) {
    const request = await this.getOwnedRequest(userId, fosterRequestId);

    if (request.status !== FosterRequestStatus.APPROVED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Transport can only be created for approved foster requests',
      );
    }

    if (request.transportId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Transport already exists for this foster request',
      );
    }

    const [pickup, dropoff] = await Promise.all([
      this.geocodeAddress(dto.pickupLocation),
      this.geocodeAddress(dto.dropoffLocation),
    ]);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { id: dto.driverId },
      });

      if (!driver) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Driver not found');
      }

      if (driver.status !== 'APPROVED') {
        throw new AppError(HttpStatus.BAD_REQUEST, 'Driver is not approved');
      }

      const transport = await tx.transport.create({
        data: {
          transportNote:
            dto.transportNote ||
            'Foster transport scheduled from foster module',
          priorityLevel: PriorityLevel.MEDIUM,
          pickUpLocation: dto.pickupLocation,
          pickUpLatitude: pickup.lat,
          pickUpLongitude: pickup.lng,
          dropOffLocation: dto.dropoffLocation,
          dropOffLatitude: dropoff.lat,
          dropOffLongitude: dropoff.lng,
          transPortDate: new Date(dto.transportDate),
          animalId: request.animalId,
          driverId: dto.driverId,
          shelterId: request.shelterId,
          status: TransportStatus.PENDING,
          vehicleName: dto.vehicleName,
        },
      });

      await tx.transportTimeline.create({
        data: {
          transportId: transport.id,
          status: TransportStatus.PENDING,
          note: 'Foster transport scheduled',
          latitude: pickup.lat,
          longitude: pickup.lng,
        },
      });

      await tx.animal.update({
        where: { id: request.animalId },
        data: { status: 'IN_TRANSIT' },
      });

      return tx.fosterRequest.update({
        where: { id: request.id },
        data: {
          status: FosterRequestStatus.SCHEDULED,
          transportId: transport.id,
        },
        include: this.detailInclude,
      });
    });

    await this.userNotificationService.notifyFosterRequestEvent(
      'SCHEDULED',
      updated.id,
    );

    return successResponse(
      await this.formatDetail(updated),
      'Foster transport created successfully',
    );
  }

  @HandleError('Failed to get foster tracking')
  async getFosterTracking(userId: string, fosterRequestId: string) {
    const request = await this.getOwnedRequest(userId, fosterRequestId);

    if (
      request.status !== FosterRequestStatus.SCHEDULED ||
      !request.transportId
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Tracking is only available for scheduled foster requests',
      );
    }

    const liveData = await this.trackingDataService.getLiveTrackingData(
      request.transportId,
    );

    if (!liveData || liveData.success === false) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Live tracking is not available for this foster request',
      );
    }

    const arrived = request.transport?.status === TransportStatus.COMPLETED;

    if (arrived) {
      return successResponse(
        {
          trackingStatus: 'arrived',
          progressPercent: 100,
          arrivedAt: this.formatTime(request.transport?.completedAt),
          message: 'Please receive your pet',
          driver: {
            id: request.transport?.driver?.id ?? null,
            name: request.transport?.driver?.user?.name ?? null,
            phone: request.transport?.driver?.phone ?? null,
            photo: request.transport?.driver?.user?.profilePictureUrl ?? null,
            vehicle:
              request.transport?.vehicleName ??
              request.transport?.driver?.vehicleType ??
              null,
          },
          deliverTo: request.fosterUser?.name ?? null,
          arrivalProofAvailable: !!request.arrivalProof,
        },
        'Foster tracking fetched successfully',
      );
    }

    return successResponse(
      {
        trackingStatus: 'in_transit',
        progressPercent: liveData.progressPercentage,
        estimatedArrival: this.formatTime(liveData.estimatedDropOffTime),
        estimatedTimeLeft: `${liveData.estimatedTimeRemainingMinutes} minutes`,
        driverLocation: {
          lat: liveData.currentLatitude,
          lng: liveData.currentLongitude,
        },
        mapRoute: {
          origin: {
            lat: liveData.pickUpLatitude,
            lng: liveData.pickUpLongitude,
          },
          destination: {
            lat: liveData.dropOffLatitude,
            lng: liveData.dropOffLongitude,
          },
        },
        pickupLocation: liveData.pickUpLocation,
        currentLocation: liveData.currentLocation,
        dropoffLocation: liveData.dropOffLocation,
        driver: {
          id: request.transport?.driver?.id ?? null,
          name: request.transport?.driver?.user?.name ?? liveData.driverName,
          phone: request.transport?.driver?.phone ?? null,
          photo: request.transport?.driver?.user?.profilePictureUrl ?? null,
          vehicle:
            request.transport?.vehicleName ??
            request.transport?.driver?.vehicleType ??
            null,
        },
        deliverTo: request.fosterUser?.name ?? null,
        routeMilestones: (liveData.milestones ?? []).map((milestone: any) => ({
          label: milestone.name,
          scheduledAt: milestone.eta,
          distanceMi: Number(
            ((milestone.distanceFromPickup ?? 0) * 0.000621371).toFixed(2),
          ),
          reached: false,
        })),
        recentUpdates: (liveData.timeLine ?? []).map((item: any) => ({
          message: item.note ?? item.status,
          timestamp: item.changedAt ?? item.createdAt ?? new Date(),
        })),
        arrivalProofAvailable: !!request.arrivalProof,
      },
      'Foster tracking fetched successfully',
    );
  }

  @HandleError('Failed to get arrival proof')
  async getArrivalProof(userId: string, fosterRequestId: string) {
    const request = await this.getOwnedRequest(userId, fosterRequestId);

    const proofVisible =
      request.status === FosterRequestStatus.DELIVERED ||
      request.transport?.status === TransportStatus.COMPLETED;

    if (!proofVisible) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Arrival proof is only available for delivered or arrived transports',
      );
    }

    if (!request.arrivalProof) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Arrival proof not found');
    }

    return successResponse(
      {
        animalName: request.animal.name,
        arrivedAt: this.formatDateTime(request.arrivalProof.confirmedAt),
        photo: request.arrivalProof.photoUrl,
        notes: request.arrivalProof.notes,
      },
      'Arrival proof fetched successfully',
    );
  }

  private readonly listInclude = {
    animal: {
      select: {
        id: true,
        name: true,
        imageUrl: true,
        species: true,
        gender: true,
      },
    },
    fosterUser: {
      select: {
        id: true,
        name: true,
        profilePictureUrl: true,
        fosters: {
          select: {
            city: true,
            state: true,
          },
        },
      },
    },
    transport: {
      select: {
        id: true,
        status: true,
        transPortDate: true,
      },
    },
  };

  private readonly listInterestInclude = {
    animal: {
      select: {
        id: true,
        name: true,
        imageUrl: true,
        species: true,
        gender: true,
      },
    },
    foster: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true,
          },
        },
      },
    },
  };

  private readonly detailInclude = {
    animal: {
      include: {
        image: true,
        shelter: true,
      },
    },
    fosterUser: {
      include: {
        profilePicture: true,
        fosters: true,
      },
    },
    arrivalProof: true,
    transport: {
      include: {
        driver: {
          include: {
            user: true,
          },
        },
        transportTimelines: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
    },
  };

  private async getShelterId(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user?.shelterAdminOfId ?? user?.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    return shelterId;
  }

  private async getOwnedRequest(userId: string, fosterRequestId: string) {
    const shelterId = await this.getShelterId(userId);
    const request = await this.prisma.client.fosterRequest.findFirst({
      where: { id: fosterRequestId, shelterId },
      include: this.detailInclude,
    });

    if (!request) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Foster request not found');
    }

    return request;
  }

  private normalizeStatusFilter(status?: string) {
    if (!status) return null;

    const normalized = status.trim().toLowerCase();
    const map: Record<string, FosterRequestStatus> = {
      requested: FosterRequestStatus.REQUESTED,
      interested: FosterRequestStatus.INTERESTED,
      approved: FosterRequestStatus.APPROVED,
      scheduled: FosterRequestStatus.SCHEDULED,
      delivered: FosterRequestStatus.DELIVERED,
      completed: FosterRequestStatus.DELIVERED,
      cancelled: FosterRequestStatus.CANCELLED,
    };

    if (!map[normalized]) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Invalid foster status filter',
      );
    }

    return map[normalized];
  }

  private toClientStatus(status: FosterRequestStatus) {
    return status.toLowerCase() as
      | 'requested'
      | 'interested'
      | 'approved'
      | 'scheduled'
      | 'delivered'
      | 'cancelled';
  }

  private toDisplayStatus(status: FosterRequestStatus) {
    return status === FosterRequestStatus.DELIVERED
      ? 'completed'
      : this.toClientStatus(status);
  }

  private validateCreatePayload() {
    // Both spay dates are optional now as per request
  }

  private validateUpdatePayload() {
    // Both spay dates are optional now as per request
  }

  private async validateShelterAnimal(
    tx: Prisma.TransactionClient,
    shelterId: string,
    animalId: string,
  ) {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, shelterId },
      select: { id: true, status: true },
    });

    if (!animal) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal does not belong to this shelter',
      );
    }

    if (animal.status !== 'AT_SHELTER') {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal is not available for foster',
      );
    }
  }

  private async ensureAnimalHasNoActiveRequest(
    tx: Prisma.TransactionClient,
    animalId: string,
    excludedRequestId?: string,
  ) {
    const existing = await tx.fosterRequest.findFirst({
      where: {
        animalId,
        status: { in: ACTIVE_STATUSES },
        ...(excludedRequestId ? { id: { not: excludedRequestId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Animal already has an active foster request',
      );
    }
  }

  private async geocodeAddress(address: string) {
    const response = await this.googleMapsService.getClient().geocode({
      params: {
        address,
        key: this.googleMapsService.getApiKey(),
      },
    });

    const location = response.data.results?.[0]?.geometry?.location;
    if (!location) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Unable to resolve address: ${address}`,
      );
    }

    return { lat: location.lat, lng: location.lng };
  }

  private formatListItem(request: any) {
    const status = this.toClientStatus(request.status);
    const location =
      request.fosterUser?.fosters?.city && request.fosterUser?.fosters?.state
        ? `${request.fosterUser.fosters.city}, ${request.fosterUser.fosters.state}`
        : null;

    return {
      id: request.id,
      type: 'SHELTER_REQUEST',
      status,
      displayStatus: this.toDisplayStatus(request.status),
      canCreateTransport: request.status === FosterRequestStatus.APPROVED,
      animal: request.animal
        ? {
            id: request.animal.id,
            name: request.animal.name,
            photo: request.animal.imageUrl,
            type: request.animal.species,
            gender: request.animal.gender,
          }
        : null,
      fosterUser: request.fosterUser
        ? {
            id: request.fosterUser.id,
            name: request.fosterUser.name,
            avatar: request.fosterUser.profilePictureUrl,
          }
        : null,
      location,
      requestedAt: this.formatDateTime(request.requestedAt),
      createdAt: request.requestedAt,
      cancelledAt: request.cancelledAt ?? null,
      cancelReason: request.cancelReason ?? null,
      note: request.shelterNote || request.petPersonality || null,
      transportTime:
        request.status === FosterRequestStatus.SCHEDULED &&
        request.transport?.transPortDate
          ? this.formatDateTime(request.transport.transPortDate)
          : null,
    };
  }

  private formatInterestListItem(interest: any) {
    const status = interest.status.toLowerCase();
    const location =
      interest.foster?.city && interest.foster?.state
        ? `${interest.foster.city}, ${interest.foster.state}`
        : null;

    return {
      id: interest.id,
      type: 'FOSTER_INTEREST',
      status,
      interestStatus: interest.status,
      displayStatus: this.toDisplayStatusFromInterest(interest.status),
      animal: interest.animal
        ? {
            id: interest.animal.id,
            name: interest.animal.name,
            photo: interest.animal.imageUrl,
            type: interest.animal.species,
            gender: interest.animal.gender,
          }
        : null,
      fosterUser: interest.foster?.user
        ? {
            id: interest.foster.user.id,
            name: interest.foster.user.name,
            avatar: interest.foster.user.profilePictureUrl,
          }
        : null,
      location,
      requestedAt: this.formatDateTime(interest.createdAt),
      createdAt: interest.createdAt,
      cancelledAt: interest.cancelledAt ?? null,
      note:
        interest.animal?.behaviorNotes || interest.animal?.specialNeeds || null,
    };
  }

  private toDisplayStatusFromInterest(status: FosterInterestStatus) {
    const map: Record<FosterInterestStatus, string> = {
      INTERESTED: 'Interested',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      WITHDRAWN: 'Cancelled',
      COMPLETED: 'Completed',
    };
    return map[status] || status.toLowerCase();
  }

  private async formatDetail(request: any) {
    let previousHistory: any[] = [];

    if (request.fosterUserId) {
      const previous = await this.prisma.client.fosterRequest.findMany({
        where: {
          fosterUserId: request.fosterUserId,
          status: FosterRequestStatus.DELIVERED,
          id: { not: request.id },
        },
        include: {
          animal: {
            select: { name: true, imageUrl: true },
          },
        },
        orderBy: { deliveryTime: 'desc' },
        take: 5,
      });

      previousHistory = previous.map((item) => ({
        animalName: item.animal?.name ?? null,
        animalPhoto: item.animal?.imageUrl ?? null,
        durationMonths:
          item.deliveryTime && item.createdAt
            ? Math.max(
                0,
                Math.round(
                  (item.deliveryTime.getTime() - item.createdAt.getTime()) /
                    (1000 * 60 * 60 * 24 * 30),
                ),
              )
            : null,
        completedAt: item.deliveryTime,
      }));
    }

    return {
      id: request.id,
      status: this.toClientStatus(request.status),
      displayStatus: this.toDisplayStatus(request.status),
      availableActions: this.getAvailableActions(request.status),
      animal: request.animal
        ? {
            id: request.animal.id,
            name: request.animal.name,
            photo: request.animal.imageUrl,
            type: request.animal.species,
            gender: request.animal.gender,
            age: request.animal.age,
            weight: request.animal.weight,
            size: null,
          }
        : null,
      healthInfo: {
        spayNeuterAvailable: request.spayNeuterAvailable,
        spayNeuterDate: request.spayNeuterDate,
        spayNeuterNextDate: request.spayNeuterNextDate,
        lastCheckupDate: request.lastCheckupDate,
        vaccinationsDate: request.vaccinationsDate,
      },
      petPersonality: request.petPersonality,
      specialNote: request.shelterNote,
      shelterName: request.animal?.shelter?.name ?? null,
      estimateTransportDate: request.estimateTransportDate,
      estimateTransportTimeStart: request.estimateTransportTimeStart,
      estimateTransportTimeEnd: request.estimateTransportTimeEnd,
      fosterUser: request.fosterUser
        ? {
            id: request.fosterUser.id,
            name: request.fosterUser.name,
            avatar: request.fosterUser.profilePictureUrl,
            experienceLabel:
              request.fosterUser.fosters?.experienceLevel ?? 'Not specified',
            location: [
              request.fosterUser.fosters?.city,
              request.fosterUser.fosters?.state,
            ]
              .filter(Boolean)
              .join(', '),
            email: request.fosterUser.email,
            phone: request.fosterUser.fosters?.phone ?? null,
            fosterNote: null,
            preferences: request.fosterUser.fosters
              ? {
                  animalTypes: request.fosterUser.fosters.animalType,
                  ageRange: request.fosterUser.fosters.age,
                  locationRadius: request.fosterUser.fosters.preferredMile,
                }
              : null,
            previousFosterHistory: previousHistory,
          }
        : null,
      transport: request.transport
        ? {
            id: request.transport.id,
            status: request.transport.status.toLowerCase(),
            transportDate: request.transport.transPortDate,
            deliveryTime: request.deliveryTime,
            pickupLocation: request.transport.pickUpLocation,
            dropoffLocation: request.transport.dropOffLocation,
            vehicleName: request.transport.vehicleName,
            recentUpdates: request.transport.transportTimelines.map(
              (timeline: any) => ({
                message: timeline.note ?? timeline.status,
                timestamp: timeline.createdAt,
              }),
            ),
          }
        : null,
      driver: request.transport?.driver
        ? {
            id: request.transport.driver.id,
            name: request.transport.driver.user?.name ?? null,
            phone: request.transport.driver.phone,
            photo: request.transport.driver.user?.profilePictureUrl ?? null,
          }
        : null,
      cancelledAt: request.cancelledAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private getAvailableActions(status: FosterRequestStatus) {
    const map: Record<FosterRequestStatus, string[]> = {
      REQUESTED: ['cancel_request', 'view_details'],
      INTERESTED: ['approve', 'decline', 'message'],
      APPROVED: ['create_transport', 'message'],
      SCHEDULED: ['track_transport', 'message_foster', 'message_driver'],
      DELIVERED: ['message_foster', 'message_driver'],
      CANCELLED: [],
    };

    return map[status];
  }

  private asDate(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private formatTime(value?: Date | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(value);
  }

  private formatDateTime(value?: Date | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(value);
  }
}
