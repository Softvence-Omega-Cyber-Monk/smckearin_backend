import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FosterInterestStatus,
  FosterRequestStatus,
  Prisma,
  SPECIES,
  Status,
  TransportStatus,
} from '@prisma';
import {
  ConfirmReceiptDto,
  FosterAnimalAgeRangeFilter,
  FosterAnimalSizeFilter,
  FosterRequestViewStatus,
  GetFosterAnimalsDto,
  GetFosterRequestsDto,
} from '../dto/foster-animal.dto';

type FosterContext = {
  id: string;
  address: string;
  phone: string;
  preferredLocation: string;
  preferredMile: number;
  animalType: string;
  sizePreference: string;
  age: string;
  user: {
    id: string;
    name: string;
  };
};

@Injectable()
export class FosterAnimalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Failed to get foster dashboard')
  async getDashboard(userId: string, dto: PaginationDto) {
    const foster = await this.getFosterContext(userId);
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 5;
    const skip = (page - 1) * limit;

    const [
      activeInterestCount,
      activeRequestCount,
      approvedInterests,
      scheduledRequests,
      interestPreview,
      requestPreview,
      recommended,
    ] = await Promise.all([
      this.prisma.client.fosterAnimalInterest.count({
        where: {
          fosterId: foster.id,
          status: {
            in: [
              FosterInterestStatus.INTERESTED,
              FosterInterestStatus.APPROVED,
            ],
          },
        },
      }),
      this.prisma.client.fosterRequest.count({
        where: {
          fosterUserId: userId,
          status: {
            in: [
              FosterRequestStatus.REQUESTED,
              FosterRequestStatus.INTERESTED,
              FosterRequestStatus.APPROVED,
              FosterRequestStatus.SCHEDULED,
            ],
          },
        },
      }),
      this.prisma.client.fosterAnimalInterest.findMany({
        where: {
          fosterId: foster.id,
          status: FosterInterestStatus.APPROVED,
        },
        orderBy: { createdAt: 'desc' },
        include: this.requestInclude,
      }),
      this.prisma.client.fosterRequest.findMany({
        where: {
          fosterUserId: userId,
          status: FosterRequestStatus.SCHEDULED,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          animal: {
            include: {
              shelter: true,
              healthReports: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          shelter: true,
          transport: true,
        },
      }),
      this.prisma.client.fosterAnimalInterest.findMany({
        where: {
          fosterId: foster.id,
          status: {
            in: [
              FosterInterestStatus.INTERESTED,
              FosterInterestStatus.APPROVED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: this.requestInclude,
      }),
      this.prisma.client.fosterRequest.findMany({
        where: {
          fosterUserId: userId,
          status: {
            in: [
              FosterRequestStatus.REQUESTED,
              FosterRequestStatus.INTERESTED,
              FosterRequestStatus.APPROVED,
              FosterRequestStatus.SCHEDULED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          animal: {
            include: {
              shelter: true,
            },
          },
          shelter: true,
          transport: true,
        },
      }),
      this.getRecommendedAnimals(foster, 10),
    ]);

    const now = new Date();

    // Mapping Foster Interests with transport
    const approvedInterestsWithTransport = approvedInterests
      .map((interest) => ({
        interest,
        transport: this.getMostRelevantTransport(interest.animal.transports),
      }))
      .filter((item) => item.transport);

    // Combining scheduled foster-requests and approved interests
    const upcomingArrivalsFromInterests = approvedInterestsWithTransport
      .filter(
        (item) =>
          item.transport &&
          item.transport.status !== TransportStatus.COMPLETED &&
          item.transport.status !== TransportStatus.CANCELLED &&
          item.transport.transPortDate >= now,
      )
      .map(({ interest, transport }) =>
        this.formatUpcomingArrival(interest, transport!),
      );

    const upcomingArrivalsFromRequests = scheduledRequests
      .filter(
        (req) =>
          req.transport &&
          req.transport.status !== TransportStatus.COMPLETED &&
          req.transport.status !== TransportStatus.CANCELLED &&
          req.transport.transPortDate >= now,
      )
      .map((req) => this.formatUpcomingArrivalFromRequest(req));

    // Final merge and sort by transport date
    const upcomingArrivals = [
      ...upcomingArrivalsFromInterests,
      ...upcomingArrivalsFromRequests,
    ].sort((a, b) => a.tripTime.date.getTime() - b.tripTime.date.getTime());

    const completedInterestsCount = approvedInterestsWithTransport.filter(
      ({ transport }) => transport?.status === TransportStatus.COMPLETED,
    ).length;

    const completedRequestsCount = await this.prisma.client.fosterRequest.count(
      {
        where: {
          fosterUserId: userId,
          status: FosterRequestStatus.COMPLETED,
        },
      },
    );

    return successResponse(
      {
        welcomeName: foster.user.name,
        stats: {
          myRequests: activeInterestCount + activeRequestCount,
          complete: completedInterestsCount + completedRequestsCount,
        },
        upcomingArrivals,
        myRequests: [
          ...interestPreview.map((interest) =>
            this.formatRequestItem(interest),
          ),
          ...requestPreview.map((req) =>
            this.formatRequestItemFromShelter(req),
          ),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        recommendedForYou: recommended,
      },
      'Foster dashboard fetched successfully',
    );
  }

  @HandleError('Failed to get foster animals')
  async getAnimals(userId: string, dto: GetFosterAnimalsDto) {
    const foster = await this.getFosterContext(userId);
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where = await this.buildAnimalWhere(dto, foster.id);

    const [animals, total] = await this.prisma.client.$transaction([
      this.prisma.client.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.animalInclude(foster.id),
      }),
      this.prisma.client.animal.count({ where }),
    ]);

    return successPaginatedResponse(
      animals.map((animal) => this.formatAnimalCard(animal)),
      { page, limit, total },
      'Available foster animals fetched successfully',
    );
  }

  @HandleError('Failed to get foster animal details')
  async getAnimalDetails(userId: string, animalId: string) {
    const foster = await this.getFosterContext(userId);

    const animal = await this.prisma.client.animal.findFirst({
      where: {
        id: animalId,
        shelter: {
          status: 'APPROVED',
        },
      },
      include: this.animalInclude(foster.id),
    });

    if (!animal) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Animal not found');
    }

    return successResponse(
      this.formatAnimalDetails(animal),
      'Animal details fetched successfully',
    );
  }

  @HandleError('Failed to get foster requests')
  async getMyRequests(userId: string, dto: GetFosterRequestsDto) {
    const foster = await this.getFosterContext(userId);
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;

    // 1. Fetch Interests
    const interests = await this.prisma.client.fosterAnimalInterest.findMany({
      where: {
        fosterId: foster.id,
        status: {
          in: [
            FosterInterestStatus.INTERESTED,
            FosterInterestStatus.APPROVED,
            FosterInterestStatus.REJECTED,
            FosterInterestStatus.WITHDRAWN,
            FosterInterestStatus.COMPLETED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: this.requestInclude,
    });

    // 2. Fetch Shelter-initiated Requests
    const requests = await this.prisma.client.fosterRequest.findMany({
      where: {
        fosterUserId: userId,
        status: {
          in: [
            FosterRequestStatus.REQUESTED,
            FosterRequestStatus.INTERESTED,
            FosterRequestStatus.APPROVED,
            FosterRequestStatus.SCHEDULED,
            FosterRequestStatus.COMPLETED,
            FosterRequestStatus.CANCELLED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: this.fosterRequestInclude,
    });

    // 3. Map and Combine
    const mappedInterests = interests.map((interest) =>
      this.formatRequestItem(interest),
    );

    const mappedShelterRequests = requests.map((req) =>
      this.formatRequestItemFromShelter(req),
    );

    const combinedRequests = [
      ...mappedInterests,
      ...mappedShelterRequests,
    ].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // 4. Filter by status if provided
    const statusFilter = dto.status?.toUpperCase();
    const filteredRequests = statusFilter
      ? combinedRequests.filter(
          (request: any) => request.status?.toUpperCase() === statusFilter,
        )
      : combinedRequests;

    const total = filteredRequests.length;
    const skip = (page - 1) * limit;
    const paginatedRequests = filteredRequests.slice(skip, skip + limit);

    return successPaginatedResponse(
      paginatedRequests,
      { page, limit, total },
      'Foster requests fetched successfully',
    );
  }

  @HandleError('Failed to get request details')
  async getRequestDetails(userId: string, requestId: string) {
    const foster = await this.getFosterContext(userId);

    // Try finding in Interests first
    const interest = await this.prisma.client.fosterAnimalInterest.findUnique({
      where: { id: requestId },
      include: {
        animal: {
          include: {
            shelter: true,
            healthReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            transports: {
              orderBy: { transPortDate: 'desc' },
              take: 5,
            },
          },
        },
        shelter: {
          include: {
            shelterAdmins: {
              select: { email: true },
              take: 1,
            },
          },
        },
      },
    });

    if (interest && interest.fosterId === foster.id) {
      return successResponse(
        this.formatDetailedInterest(interest),
        'Interest details fetched successfully',
      );
    }

    // Try finding in Shelter-initiated requests
    const request = await this.prisma.client.fosterRequest.findUnique({
      where: { id: requestId },
      include: {
        animal: {
          include: {
            shelter: true,
            healthReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        shelter: {
          include: {
            shelterAdmins: {
              select: { email: true },
              take: 1,
            },
          },
        },
        transport: true,
      },
    });

    if (request && request.fosterUserId === userId) {
      return successResponse(
        this.formatDetailedShelterRequest(request),
        'Foster request details fetched successfully',
      );
    }

    throw new AppError(HttpStatus.NOT_FOUND, 'Foster request not found');
  }

  @HandleError('Failed to cancel request')
  async cancelRequest(userId: string, requestId: string) {
    const foster = await this.getFosterContext(userId);

    // Try finding in Interests first
    const interest = await this.prisma.client.fosterAnimalInterest.findFirst({
      where: { id: requestId, fosterId: foster.id },
    });

    if (interest) {
      const updated = await this.prisma.client.fosterAnimalInterest.update({
        where: { id: requestId },
        data: {
          status: FosterInterestStatus.WITHDRAWN,
          cancelledAt: new Date(),
        },
      });

      return successResponse(updated, 'Interest withdrawn successfully');
    }

    // Try finding in Shelter-initiated requests
    const request = await this.prisma.client.fosterRequest.findFirst({
      where: { id: requestId, fosterUserId: userId },
    });

    if (request) {
      const updated = await this.prisma.client.$transaction(async (tx) => {
        if (request.transportId) {
          await tx.transport.update({
            where: { id: request.transportId },
            data: { status: TransportStatus.CANCELLED },
          });

          await tx.transportTimeline.create({
            data: {
              transportId: request.transportId,
              status: TransportStatus.CANCELLED,
              note: 'Cancelled by foster',
            },
          });

          await tx.animal.update({
            where: { id: request.animalId },
            data: { status: 'AT_SHELTER' },
          });
        }

        return tx.fosterRequest.update({
          where: { id: requestId },
          data: {
            status: FosterRequestStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: 'Cancelled by foster',
          },
        });
      });

      return successResponse(updated, 'Request cancelled successfully');
    }

    throw new AppError(HttpStatus.NOT_FOUND, 'Foster request not found');
  }

  @HandleError('Failed to confirm animal receipt')
  async confirmReceipt(
    userId: string,
    requestId: string,
    dto: ConfirmReceiptDto,
  ) {
    const foster = await this.getFosterContext(userId);

    // Try finding in Interests first
    const interest = await this.prisma.client.fosterAnimalInterest.findFirst({
      where: { id: requestId, fosterId: foster.id },
      include: {
        animal: {
          include: {
            transports: {
              where: { status: { not: TransportStatus.CANCELLED } },
              orderBy: { transPortDate: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (interest) {
      if (interest.status === FosterInterestStatus.COMPLETED) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'Receipt already confirmed');
      }

      return this.prisma.client.$transaction(async (tx) => {
        if (dto.proof) {
          const uploaded = await this.s3.uploadFile(dto.proof);
          await tx.arrivalProof.create({
            data: {
              interestId: interest.id,
              photoId: uploaded.id,
              photoUrl: uploaded.url,
              notes: dto.notes,
            },
          });
        }

        const transport = interest.animal.transports[0];
        if (transport) {
          await tx.transport.update({
            where: { id: transport.id },
            data: {
              status: TransportStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          await tx.transportTimeline.create({
            data: {
              transportId: transport.id,
              status: TransportStatus.COMPLETED,
              note: dto.notes || 'Animal received by foster',
            },
          });
        }

        await tx.animal.update({
          where: { id: interest.animalId },
          data: {
            status: Status.FOSTERED,
            fosteredById: foster.id,
          },
        });

        const updated = await tx.fosterAnimalInterest.update({
          where: { id: requestId },
          data: {
            status: FosterInterestStatus.COMPLETED,
          },
        });

        return successResponse(updated, 'Receipt confirmed successfully');
      });
    }

    // Try finding in Shelter-initiated requests
    const request = await this.prisma.client.fosterRequest.findFirst({
      where: { id: requestId, fosterUserId: userId },
      include: {
        animal: true,
      },
    });

    if (request) {
      if (request.status === FosterRequestStatus.DELIVERED) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'Receipt already confirmed');
      }

      return this.prisma.client.$transaction(async (tx) => {
        if (dto.proof) {
          const uploaded = await this.s3.uploadFile(dto.proof);
          await tx.arrivalProof.create({
            data: {
              fosterRequestId: request.id,
              photoId: uploaded.id,
              photoUrl: uploaded.url,
              notes: dto.notes,
            },
          });
        }

        if (request.transportId) {
          await tx.transport.update({
            where: { id: request.transportId },
            data: {
              status: TransportStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          await tx.transportTimeline.create({
            data: {
              transportId: request.transportId,
              status: TransportStatus.COMPLETED,
              note: dto.notes || 'Animal received by foster',
            },
          });
        }

        await tx.animal.update({
          where: { id: request.animalId },
          data: {
            status: Status.FOSTERED,
            fosteredById: foster.id,
          },
        });

        const updated = await tx.fosterRequest.update({
          where: { id: requestId },
          data: {
            status: FosterRequestStatus.COMPLETED,
            deliveryTime: new Date(),
          },
        });

        return successResponse(updated, 'Receipt confirmed successfully');
      });
    }

    throw new AppError(HttpStatus.NOT_FOUND, 'Foster request not found');
  }

  private formatDetailedInterest(interest: any) {
    const animal = interest.animal;
    const latestHealthReport = animal.healthReports[0] ?? null;
    const transport = this.getMostRelevantTransport(animal.transports);
    const shelter = interest.shelter;
    const shelterEmail = shelter?.shelterAdmins?.[0]?.email ?? null;

    return {
      id: interest.id,
      type: 'INTEREST',
      status: interest.status,
      animal: {
        id: animal.id,
        name: animal.name,
        breed: animal.breed,
        age: this.formatAge(animal.age),
        imageUrl: animal.imageUrl,
        species: animal.species,
      },
      requestInformation: {
        submitted: interest.createdAt,
        estimatedTransportDate:
          transport?.transPortDate ?? interest.preferredArrivalDate ?? null,
      },
      healthInformation: {
        spayNeuterDate: null,
        lastCheckUp: latestHealthReport?.createdAt ?? null,
        vaccinationsStatus: animal.vaccinationsUpToDate
          ? 'up to date'
          : 'unknown',
      },
      shelterContact: {
        name: shelter?.name ?? 'Unknown Shelter',
        phone: shelter?.phone ?? null,
        email: shelterEmail,
      },
      notes:
        animal.behaviorNotes || animal.specialNeeds || 'No specific notes.',
      cancelledAt: interest.cancelledAt ?? null,
    };
  }

  private formatDetailedShelterRequest(request: any) {
    const animal = request.animal;
    const latestHealthReport = animal.healthReports[0] ?? null;
    const shelter = request.shelter;
    const shelterEmail = shelter?.shelterAdmins?.[0]?.email ?? null;

    return {
      id: request.id,
      type: 'SHELTER_REQUEST',
      status: request.status,
      animal: {
        id: animal.id,
        name: animal.name,
        breed: animal.breed,
        age: this.formatAge(animal.age),
        imageUrl: animal.imageUrl,
        species: animal.species,
      },
      requestInformation: {
        submitted: request.createdAt,
        estimatedTransportDate: request.estimateTransportDate,
      },
      healthInformation: {
        spayNeuterDate: request.spayNeuterDate ?? null,
        lastCheckUp:
          request.lastCheckupDate ?? latestHealthReport?.createdAt ?? null,
        vaccinationsStatus: request.vaccinationsDate ? 'up to date' : 'unknown',
      },
      shelterContact: {
        name: shelter?.name ?? 'Unknown Shelter',
        phone: shelter?.phone ?? null,
        email: shelterEmail,
      },
      notes:
        request.shelterNote || request.petPersonality || 'No specific notes.',
      cancelledAt: request.cancelledAt ?? null,
      cancelReason: request.cancelReason ?? null,
    };
  }

  private readonly requestInclude = {
    animal: {
      include: {
        shelter: true,
        healthReports: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
        transports: {
          orderBy: { transPortDate: 'desc' as const },
          take: 5,
        },
      },
    },
    shelter: true,
  };

  private readonly fosterRequestInclude = {
    animal: {
      include: {
        shelter: true,
        healthReports: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
    },
    shelter: true,
    transport: true,
  };

  private animalInclude(fosterId: string) {
    return {
      shelter: true,
      healthReports: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
      },
      transports: {
        orderBy: { transPortDate: 'asc' as const },
        take: 5,
      },
      fosterAnimalInterests: {
        where: {
          fosterId,
          status: {
            in: [
              FosterInterestStatus.INTERESTED,
              FosterInterestStatus.APPROVED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
      fosterRequests: {
        where: {
          status: {
            in: [
              FosterRequestStatus.REQUESTED,
              FosterRequestStatus.INTERESTED,
              FosterRequestStatus.APPROVED,
              FosterRequestStatus.SCHEDULED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    };
  }

  private async getFosterContext(userId: string): Promise<FosterContext> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        fosters: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user.fosters) {
      throw new AppError(HttpStatus.FORBIDDEN, 'Foster profile not found');
    }

    if (user.fosters.status !== 'APPROVED') {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Only approved fosters can access this feature',
      );
    }

    return user.fosters as FosterContext;
  }

  private async buildAnimalWhere(
    dto: GetFosterAnimalsDto,
    fosterId?: string,
  ): Promise<Prisma.AnimalWhereInput> {
    const where: Prisma.AnimalWhereInput = {
      status: Status.AT_SHELTER,
      shelterId: { not: null },
    };

    const andFilters: Prisma.AnimalWhereInput[] = [
      {
        shelter: {
          status: 'APPROVED',
        },
      },
    ];

    if (fosterId) {
      const foster = await this.prisma.client.foster.findUnique({
        where: { id: fosterId },
        select: { userId: true },
      });

      andFilters.push({
        fosterAnimalInterests: {
          none: {
            fosterId,
            status: {
              in: [
                FosterInterestStatus.INTERESTED,
                FosterInterestStatus.APPROVED,
              ],
            },
          },
        },
      });

      if (foster?.userId) {
        andFilters.push({
          fosterRequests: {
            none: {
              fosterUserId: foster.userId,
              status: {
                not: FosterRequestStatus.CANCELLED,
              },
            },
          },
        });
      }
    }

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { breed: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.animalTypes?.length) {
      where.species = {
        in: dto.animalTypes,
      };
    }

    if (dto.locationSearch) {
      andFilters.push({
        shelter: {
          OR: [
            {
              name: {
                contains: dto.locationSearch,
                mode: 'insensitive',
              },
            },
            {
              address: {
                contains: dto.locationSearch,
                mode: 'insensitive',
              },
            },
          ],
        },
      });
    }

    const sizeFilters = this.buildSizeFilter(dto.sizePreferences);
    const ageFilters = this.buildAgeFilter(dto.ageRanges);
    const optionalFilters = [sizeFilters, ageFilters].filter(
      Boolean,
    ) as Prisma.AnimalWhereInput[];

    if (optionalFilters.length) {
      andFilters.push(...optionalFilters);
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    return where;
  }

  private buildSizeFilter(
    sizes?: FosterAnimalSizeFilter[],
  ): Prisma.AnimalWhereInput | null {
    if (!sizes?.length || sizes.includes(FosterAnimalSizeFilter.ANY)) {
      return null;
    }

    return {
      OR: sizes.map((size) => {
        switch (size) {
          case FosterAnimalSizeFilter.SMALL:
            return { weight: { lt: 20 } };
          case FosterAnimalSizeFilter.MEDIUM:
            return { weight: { gte: 20, lte: 50 } };
          case FosterAnimalSizeFilter.LARGE:
            return { weight: { gt: 50 } };
          default:
            return {};
        }
      }),
    };
  }

  private buildAgeFilter(
    ranges?: FosterAnimalAgeRangeFilter[],
  ): Prisma.AnimalWhereInput | null {
    if (
      !ranges?.length ||
      ranges.includes(FosterAnimalAgeRangeFilter.NO_PREFERENCE)
    ) {
      return null;
    }

    return {
      OR: ranges.map((range) => {
        switch (range) {
          case FosterAnimalAgeRangeFilter.ZERO_TO_SIX_MONTHS:
            return { age: { lte: 0 } };
          case FosterAnimalAgeRangeFilter.SIX_TO_TWELVE_MONTHS:
            return { age: { lte: 1 } };
          case FosterAnimalAgeRangeFilter.ONE_TO_FIVE_YEARS:
            return { age: { gte: 1, lte: 5 } };
          case FosterAnimalAgeRangeFilter.FIVE_TO_EIGHT_YEARS:
            return { age: { gte: 5, lte: 8 } };
          default:
            return {};
        }
      }),
    };
  }

  private async getRecommendedAnimals(foster: FosterContext, limit: number) {
    const baseDto: GetFosterAnimalsDto = {
      page: 1,
      limit,
      animalTypes: this.mapPreferredAnimalTypes(foster.animalType),
      sizePreferences: this.mapPreferredSizes(foster.sizePreference),
      ageRanges: this.mapPreferredAgeRanges(foster.age),
    };

    // First attempt: Strict (including location)
    let animals = await this.prisma.client.animal.findMany({
      where: await this.buildAnimalWhere(
        { ...baseDto, locationSearch: foster.preferredLocation || undefined },
        foster.id,
      ),
      take: limit,
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      include: this.animalInclude(foster.id),
    });

    // Fallback: Broad (without location if strict returned nothing)
    if (animals.length === 0) {
      animals = await this.prisma.client.animal.findMany({
        where: await this.buildAnimalWhere(baseDto, foster.id),
        take: limit,
        orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
        include: this.animalInclude(foster.id),
      });
    }

    // Final Fallback: Ultimate (any available animals not requested by this foster)
    if (animals.length === 0) {
      animals = await this.prisma.client.animal.findMany({
        where: await this.buildAnimalWhere({}, foster.id),
        take: limit,
        orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
        include: this.animalInclude(foster.id),
      });
    }

    return animals.map((animal) => this.formatAnimalCard(animal));
  }

  private mapPreferredAnimalTypes(value: string): SPECIES[] | undefined {
    const normalized = value.toUpperCase();
    if (normalized === 'DOG') return [SPECIES.DOG];
    if (normalized === 'CAT') return [SPECIES.CAT];
    return undefined;
  }

  private mapPreferredSizes(
    value: string,
  ): FosterAnimalSizeFilter[] | undefined {
    const normalized = value.toUpperCase();
    if (normalized in FosterAnimalSizeFilter) {
      return [normalized as FosterAnimalSizeFilter];
    }
    return undefined;
  }

  private mapPreferredAgeRanges(
    value: string,
  ): FosterAnimalAgeRangeFilter[] | undefined {
    const normalized = value.toLowerCase();
    if (
      normalized.includes('0') ||
      normalized.includes('kitten') ||
      normalized.includes('puppy')
    ) {
      return [FosterAnimalAgeRangeFilter.ZERO_TO_SIX_MONTHS];
    }
    if (normalized.includes('adult') || normalized.includes('1-5')) {
      return [FosterAnimalAgeRangeFilter.ONE_TO_FIVE_YEARS];
    }
    if (normalized.includes('senior') || normalized.includes('5-8')) {
      return [FosterAnimalAgeRangeFilter.FIVE_TO_EIGHT_YEARS];
    }
    return undefined;
  }

  private getMostRelevantTransport(
    transports: Array<{
      id: string;
      transPortDate: Date;
      status: TransportStatus;
    }>,
  ) {
    if (!transports.length) {
      return null;
    }

    const activeTransport = transports.find(
      (transport) =>
        transport.status !== TransportStatus.COMPLETED &&
        transport.status !== TransportStatus.CANCELLED,
    );

    return activeTransport ?? transports[0];
  }

  private formatAnimalCard(animal: any) {
    const transport = this.getMostRelevantTransport(animal.transports);
    const interest = animal.fosterAnimalInterests[0] ?? null;
    const request = animal.fosterRequests?.[0] ?? null;

    return {
      id: animal.id,
      name: animal.name,
      breed: animal.breed,
      species: animal.species,
      age: animal.age,
      weight: animal.weight,
      size: this.getAnimalSize(animal.weight),
      imageUrl: animal.imageUrl ?? null,
      imageUrls: animal.imageUrl ? [animal.imageUrl] : [],
      badgeRow: [
        animal.breed,
        this.formatAge(animal.age),
        this.formatWeight(animal.weight),
      ],
      shelter: {
        id: animal.shelter?.id ?? null,
        name: animal.shelter?.name ?? null,
        location: animal.shelter?.address ?? null,
      },
      estimatedTransportDate:
        request?.estimateTransportDate ?? transport?.transPortDate ?? null,
      currentInterestStatus: interest?.status ?? null,
      healthInfo: {
        spayNeuterAvailable: request?.spayNeuterAvailable ?? false,
        spayNeuterDate: request?.spayNeuterDate ?? null,
        spayNeuterNextDate: request?.spayNeuterNextDate ?? null,
      },
      personalitySummary:
        animal.behaviorNotes ??
        animal.specialNeeds ??
        animal.medicalNotes ??
        '',
    };
  }

  private formatAnimalDetails(animal: any) {
    const latestHealthReport = animal.healthReports[0] ?? null;
    const latestTransport = this.getMostRelevantTransport(animal.transports);
    const currentInterest = animal.fosterAnimalInterests[0] ?? null;
    const activeRequest = animal.fosterRequests?.[0] ?? null;

    return {
      id: animal.id,
      name: animal.name,
      breed: animal.breed,
      species: animal.species,
      gender: animal.gender,
      age: animal.age,
      weight: animal.weight,
      size: this.getAnimalSize(animal.weight),
      imageUrls: animal.imageUrl ? [animal.imageUrl] : [],
      personality:
        animal.behaviorNotes ??
        animal.specialNeeds ??
        'No personality notes provided yet.',
      stats: {
        age: this.formatAge(animal.age),
        weight: this.formatWeight(animal.weight),
        size: this.getAnimalSize(animal.weight),
      },
      healthInformation: {
        spayNeuterAvailable: activeRequest?.spayNeuterAvailable ?? false,
        spayNeuterDate:
          activeRequest?.spayNeuterDate ??
          this.findReportDate(animal.healthReports, ['spay', 'neuter']),
        spayNeuterNextDate: activeRequest?.spayNeuterNextDate ?? null,
        lastCheckUp:
          activeRequest?.lastCheckupDate ??
          latestHealthReport?.createdAt ??
          null,
        vaccinationsStatus:
          activeRequest?.vaccinationsDate?.toISOString().split('T')[0] ??
          (animal.vaccinationsUpToDate ? 'Up to date' : 'Unknown'),
      },
      transportDetails: {
        shelterName: animal.shelter?.name ?? null,
        shelterLocation: animal.shelter?.address ?? null,
        estimatedTransportDate:
          activeRequest?.estimateTransportDate ??
          latestTransport?.transPortDate ??
          null,
      },
      shelterNotes:
        activeRequest?.shelterNote ??
        animal.medicalNotes ??
        animal.behaviorNotes ??
        'No shelter notes provided yet.',
      currentInterestStatus: currentInterest?.status ?? null,
      currentInterest: currentInterest
        ? {
            id: currentInterest.id,
            preferredArrivalDate: currentInterest.preferredArrivalDate,
            availableFromTime: currentInterest.availableFromTime,
            availableUntilTime: currentInterest.availableUntilTime,
            status: currentInterest.status,
          }
        : null,
    };
  }

  private formatRequestItem(interest: any) {
    const transport = this.getMostRelevantTransport(interest.animal.transports);
    const status = this.getFosterRequestStatus(interest, transport);

    return {
      id: interest.id,
      status,
      interestStatus: interest.status,
      reviewedAt: interest.reviewedAt ?? null,
      cancelledAt: interest.cancelledAt ?? null,
      createdAt: interest.createdAt,
      preferredArrivalDate: interest.preferredArrivalDate ?? null,
      availableFromTime: interest.availableFromTime,
      availableUntilTime: interest.availableUntilTime,
      animal: {
        id: interest.animal.id,
        name: interest.animal.name,
        breed: interest.animal.breed,
        gender: interest.animal.gender,
        age: this.formatAge(interest.animal.age),
        imageUrl: interest.animal.imageUrl ?? null,
      },
      shelter: {
        id: interest.shelter.id,
        name: interest.shelter.name,
        location: interest.shelter.address ?? null,
      },
      transport: transport
        ? {
            id: transport.id,
            date: transport.transPortDate,
            status: transport.status,
          }
        : null,
    };
  }

  private getFosterRequestStatus(
    interest: { status: FosterInterestStatus },
    transport: { status: TransportStatus } | null,
  ): FosterRequestViewStatus {
    if (transport?.status === TransportStatus.CANCELLED) {
      return FosterRequestViewStatus.CANCELLED;
    }

    if (transport?.status === TransportStatus.COMPLETED) {
      return FosterRequestViewStatus.COMPLETED;
    }

    if (
      transport &&
      [
        TransportStatus.PENDING,
        TransportStatus.SCHEDULED,
        TransportStatus.ACCEPTED,
        TransportStatus.PICKED_UP,
        TransportStatus.IN_TRANSIT,
      ].includes(transport.status)
    ) {
      return FosterRequestViewStatus.SCHEDULED;
    }

    if (
      interest.status === FosterInterestStatus.REJECTED ||
      interest.status === FosterInterestStatus.WITHDRAWN
    ) {
      return FosterRequestViewStatus.CANCELLED;
    }

    if (interest.status === FosterInterestStatus.COMPLETED) {
      return FosterRequestViewStatus.COMPLETED;
    }

    if (interest.status === FosterInterestStatus.APPROVED) {
      return FosterRequestViewStatus.APPROVED;
    }

    return FosterRequestViewStatus.INTERESTED;
  }

  private formatUpcomingArrival(interest: any, transport: any) {
    return {
      interestId: interest.id,
      animalId: interest.animal.id,
      transportId: transport.id,
      name: interest.animal.name,
      breed: interest.animal.breed,
      gender: interest.animal.gender,
      age: this.formatAge(interest.animal.age),
      imageUrl: interest.animal.imageUrl ?? null,
      status: 'APPROVED',
      tripTime: {
        date: transport.transPortDate,
        availableFromTime: interest.availableFromTime,
        availableUntilTime: interest.availableUntilTime,
      },
      shelter: {
        id: interest.shelter.id,
        name: interest.shelter.name,
      },
    };
  }

  private formatUpcomingArrivalFromRequest(request: any) {
    return {
      requestId: request.id,
      animalId: request.animal.id,
      transportId: request.transport.id,
      name: request.animal.name,
      breed: request.animal.breed,
      gender: request.animal.gender,
      age: this.formatAge(request.animal.age),
      imageUrl: request.animal.imageUrl ?? null,
      status: 'APPROVED',
      tripTime: {
        date: request.transport.transPortDate,
        availableFromTime: request.estimateTransportTimeStart || 'Anytime',
        availableUntilTime: request.estimateTransportTimeEnd || 'Anytime',
      },
      shelter: {
        id: request.shelter.id,
        name: request.shelter.name,
      },
    };
  }

  private formatRequestItemFromShelter(request: any) {
    return {
      id: request.id,
      status: request.status,
      interestStatus: null,
      createdAt: request.createdAt,
      cancelledAt: request.cancelledAt ?? null,
      cancelReason: request.cancelReason ?? null,
      estimateTransportDate: request.estimateTransportDate,
      animal: {
        id: request.animal.id,
        name: request.animal.name,
        breed: request.animal.breed,
        gender: request.animal.gender,
        age: this.formatAge(request.animal.age),
        imageUrl: request.animal.imageUrl ?? null,
      },
      shelter: {
        id: request.shelter.id,
        name: request.shelter.name,
        location: request.shelter.address ?? null,
      },
      transport: request.transport
        ? {
            id: request.transport.id,
            date: request.transport.transPortDate,
            status: request.transport.status,
          }
        : null,
    };
  }

  private getAnimalSize(weight: number) {
    if (weight < 20) return 'Small';
    if (weight <= 50) return 'Medium';
    return 'Large';
  }

  private formatAge(age: number) {
    return `${age} ${age === 1 ? 'year' : 'years'}`;
  }

  private formatWeight(weight: number) {
    return `${Number(weight)} lbs`;
  }

  private findReportDate(
    reports: Array<{ reportType: string; createdAt: Date }>,
    keywords: string[],
  ) {
    const match = reports.find((report) =>
      keywords.some((keyword) =>
        report.reportType.toLowerCase().includes(keyword),
      ),
    );

    return match?.createdAt ?? null;
  }
}
