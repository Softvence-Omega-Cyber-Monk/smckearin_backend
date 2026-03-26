import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FosterInterestStatus,
  Prisma,
  SPECIES,
  Status,
  TransportStatus,
} from '@prisma';
import {
  FosterAnimalAgeRangeFilter,
  FosterAnimalSizeFilter,
  GetFosterAnimalsDto,
  GetFosterRequestsDto,
  FosterRequestViewStatus,
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
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get foster dashboard')
  async getDashboard(userId: string) {
    const foster = await this.getFosterContext(userId);

    const [activeRequestCount, approvedRequests, requestPreview, recommended] =
      await Promise.all([
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
        this.prisma.client.fosterAnimalInterest.findMany({
          where: {
            fosterId: foster.id,
            status: FosterInterestStatus.APPROVED,
          },
          orderBy: { createdAt: 'desc' },
          include: this.requestInclude,
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
          take: 5,
          include: this.requestInclude,
        }),
        this.getRecommendedAnimals(foster, 10),
      ]);

    const now = new Date();

    const approvedWithTransport = approvedRequests
      .map((interest) => ({
        interest,
        transport: this.getMostRelevantTransport(interest.animal.transports),
      }))
      .filter((item) => item.transport);

    const upcomingArrivals = approvedWithTransport
      .filter(
        (item) =>
          item.transport &&
          item.transport.status !== TransportStatus.COMPLETED &&
          item.transport.status !== TransportStatus.CANCELLED &&
          item.transport.transPortDate >= now,
      )
      .sort(
        (a, b) =>
          a.transport!.transPortDate.getTime() -
          b.transport!.transPortDate.getTime(),
      )
      .map(({ interest, transport }) =>
        this.formatUpcomingArrival(interest, transport!),
      );

    const completedCount = approvedWithTransport.filter(
      ({ transport }) => transport?.status === TransportStatus.COMPLETED,
    ).length;

    return successResponse(
      {
        welcomeName: foster.user.name,
        stats: {
          myRequests: activeRequestCount,
          complete: completedCount,
        },
        upcomingArrivals,
        myRequests: requestPreview.map((interest) =>
          this.formatRequestItem(interest),
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

    const where = this.buildAnimalWhere(dto);

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
    const where: Prisma.FosterAnimalInterestWhereInput = {
      fosterId: foster.id,
      status: {
        in: [
          FosterInterestStatus.INTERESTED,
          FosterInterestStatus.APPROVED,
          FosterInterestStatus.REJECTED,
          FosterInterestStatus.WITHDRAWN,
        ],
      },
    };

    const interests = await this.prisma.client.fosterAnimalInterest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.requestInclude,
    });

    const mappedRequests = interests.map((interest) =>
      this.formatRequestItem(interest),
    );

    const filteredRequests = dto.status
      ? mappedRequests.filter((request) => request.status === dto.status)
      : mappedRequests;

    const total = filteredRequests.length;
    const skip = (page - 1) * limit;
    const paginatedRequests = filteredRequests.slice(skip, skip + limit);

    return successPaginatedResponse(
      paginatedRequests,
      { page, limit, total },
      'Foster requests fetched successfully',
    );
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

  private buildAnimalWhere(dto: GetFosterAnimalsDto): Prisma.AnimalWhereInput {
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
    const dto: GetFosterAnimalsDto = {
      page: 1,
      limit,
      animalTypes: this.mapPreferredAnimalTypes(foster.animalType),
      sizePreferences: this.mapPreferredSizes(foster.sizePreference),
      ageRanges: this.mapPreferredAgeRanges(foster.age),
      locationSearch: foster.preferredLocation || undefined,
    };

    const animals = await this.prisma.client.animal.findMany({
      where: {
        ...this.buildAnimalWhere(dto),
        fosterAnimalInterests: {
          none: {
            fosterId: foster.id,
            status: {
              in: [
                FosterInterestStatus.INTERESTED,
                FosterInterestStatus.APPROVED,
              ],
            },
          },
        },
      },
      take: limit,
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      include: this.animalInclude(foster.id),
    });

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
    transports: Array<{ transPortDate: Date; status: TransportStatus }>,
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
      estimatedTransportDate: transport?.transPortDate ?? null,
      currentInterestStatus: interest?.status ?? null,
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
        spayNeuterDate: this.findReportDate(animal.healthReports, [
          'spay',
          'neuter',
        ]),
        lastCheckUp: latestHealthReport?.createdAt ?? null,
        vaccinationsStatus: animal.vaccinationsUpToDate
          ? 'Up to date'
          : 'Unknown',
      },
      transportDetails: {
        shelterName: animal.shelter?.name ?? null,
        shelterLocation: animal.shelter?.address ?? null,
        estimatedTransportDate: latestTransport?.transPortDate ?? null,
      },
      shelterNotes:
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
