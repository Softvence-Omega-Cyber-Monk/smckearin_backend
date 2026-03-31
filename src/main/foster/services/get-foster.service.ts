import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  Foster,
  FosterInterestStatus,
  FosterRequestStatus,
  Prisma,
  User,
} from '@prisma';
import { GetApprovedFosters, GetFostersDto } from '../dto/get-fosters.dto';

type FosterWithUser = Foster & {
  user: User;
};

@Injectable()
export class GetFosterService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get fosters')
  async getAllFosters(dto: GetFostersDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FosterWhereInput = {};

    if (dto.search) {
      where.OR = [
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
        { user: { email: { contains: dto.search, mode: 'insensitive' } } },
        { phone: { contains: dto.search, mode: 'insensitive' } },
        { city: { contains: dto.search, mode: 'insensitive' } },
        { state: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.status) {
      const allowedStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED',
      ] as ApprovalStatus[];
      const statusUpper = dto.status.toUpperCase();

      if (allowedStatuses.includes(statusUpper as ApprovalStatus)) {
        where.status = statusUpper as ApprovalStatus;
      }
    }

    const [fosters, total] = await this.prisma.client.$transaction([
      this.prisma.client.foster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profilePicture: true,
            },
          },
        },
      }),
      this.prisma.client.foster.count({ where }),
    ]);

    return successPaginatedResponse(
      fosters.map(this.flattenFoster),
      { page, limit, total },
      'Fosters found',
    );
  }

  @HandleError('Failed to get approved fosters')
  async getApprovedFosters(dto: GetApprovedFosters) {
    return this.getAllFosters({ ...dto, status: 'APPROVED' });
  }

  @HandleError('Failed to get single foster')
  async getSingleFoster(userId: string, id: string) {
    // 1. Check if it's a direct Foster ID
    const foster = await this.prisma.client.foster.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profilePicture: true,
          },
        },
      },
    });

    if (foster) {
      // Find latest active transport for this foster
      const activeRequest = await this.prisma.client.fosterRequest.findFirst({
        where: {
          fosterUserId: foster.userId,
          status: {
            in: [
              FosterRequestStatus.APPROVED,
              FosterRequestStatus.SCHEDULED,
              FosterRequestStatus.DELIVERED,
            ],
          },
          transportId: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        select: { transportId: true },
      });

      return successResponse(
        {
          ...this.flattenFoster(foster),
          transportId: activeRequest?.transportId ?? null,
        },
        'Foster found',
      );
    }

    // 2. Check if it's a FosterAnimalInterest ID
    const interest = await this.prisma.client.fosterAnimalInterest.findUnique({
      where: { id },
      include: {
        animal: {
          include: {
            image: true,
            shelter: true,
          },
        },
        foster: {
          include: {
            user: {
              include: {
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    if (interest) {
      let previousHistory: any[] = [];
      if (interest.foster?.userId) {
        const previous = await this.prisma.client.fosterRequest.findMany({
          where: {
            fosterUserId: interest.foster.userId,
            status: {
              in: [
                FosterRequestStatus.DELIVERED,
                FosterRequestStatus.COMPLETED,
              ],
            },
          },
          include: {
            animal: {
              select: { name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
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
          completedAt: item.deliveryTime || item.updatedAt,
          formattedCompletedAt: this.formatDateOnly(
            item.deliveryTime || item.updatedAt,
          ),
        }));
      }

      // Find associated transport for interest
      const transport = await this.prisma.client.transport.findFirst({
        where: {
          animals: { some: { id: interest.animalId } },
          shelterId: interest.shelterId,
        },
        include: {
          driver: { include: { user: true } },
          transportTimelines: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(
        this.formatInterestDetail(interest, previousHistory, transport),
        'Foster found',
      );
    }

    // 3. Check if it's a FosterRequest ID
    const request = await this.prisma.client.fosterRequest.findUnique({
      where: { id },
      include: {
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
        transport: {
          include: {
            driver: {
              include: {
                user: true,
              },
            },
            transportTimelines: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (request) {
      let previousHistory: any[] = [];
      if (request.fosterUserId) {
        const previous = await this.prisma.client.fosterRequest.findMany({
          where: {
            fosterUserId: request.fosterUserId,
            status: {
              in: [
                FosterRequestStatus.DELIVERED,
                FosterRequestStatus.COMPLETED,
              ],
            },
            id: { not: request.id },
          },
          include: {
            animal: {
              select: { name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
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
          completedAt: item.deliveryTime || item.updatedAt,
          formattedCompletedAt: this.formatDateOnly(
            item.deliveryTime || item.updatedAt,
          ),
        }));
      }

      return successResponse(
        this.formatDetail(request, previousHistory),
        'Foster found',
      );
    }

    throw new AppError(HttpStatus.NOT_FOUND, 'Foster record not found');
  }

  @HandleError('Failed to get own foster documents')
  async getOwnFosterDocuments(userId: string) {
    const foster = await this.prisma.client.foster.findUniqueOrThrow({
      where: { userId },
    });

    const documents = await this.prisma.client.fosterDocument.findMany({
      where: { fosterId: foster.id },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(documents, 'Foster documents found');
  }

  @HandleError('Failed to get single foster document')
  async getSingleFosterDocument(documentId: string) {
    const document = await this.prisma.client.fosterDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    return successResponse(document, 'Foster document found');
  }

  private formatDetail(request: any, previousHistory: any[] = []) {
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
      animal: request.animal
        ? {
            id: request.animal.id,
            name: request.animal.name,
            photo: request.animal.imageUrl,
            type: request.animal.species,
            gender: request.animal.gender,
            age: request.animal.age || 'Unknown',
            weight: request.animal.weight || 'Unknown',
            size: request.animal.size || 'medium',
          }
        : null,
      healthInfo: {
        spayNeuterAvailable: request.spayNeuterAvailable,
        spayNeuterDate: request.spayNeuterDate,
        spayNeuterNextDate: request.spayNeuterNextDate,
        lastCheckupDate: request.lastCheckupDate,
        vaccinationsDate: request.vaccinationsDate,
      },
      petPersonality: request.petPersonality || request.animal?.behaviorNotes,
      specialNote: request.shelterNote,
      shelterName: request.animal?.shelter?.name || 'Unknown',
      estimateTransportDate: request.estimateTransportDate,
      fosterUser: request.fosterUser
        ? {
            id: request.fosterUser.id,
            name: request.fosterUser.name,
            avatar: request.fosterUser.profilePictureUrl,
            experienceLabel:
              request.fosterUser.fosters?.experienceLevel ??
              'Experienced foster',
            email: request.fosterUser.email,
            phone: request.fosterUser.fosters?.phone || 'Not provided',
            location,
            preferences: request.fosterUser.fosters
              ? {
                  animalTypes: request.fosterUser.fosters.animalType,
                  ageRange: request.fosterUser.fosters.age,
                  locationRadius: `${request.fosterUser.fosters.preferredMile || 25}+mi in`,
                }
              : null,
            previousFosterHistory: previousHistory,
          }
        : null,
      location,
      driver: request.transport?.driver
        ? {
            id: request.transport.driver.id,
            name: request.transport.driver.user?.name ?? 'Unknown',
            email: request.transport.driver.user?.email ?? 'Not provided',
            phone: request.transport.driver.phone || 'Not provided',
            location: [
              request.transport.driver.address,
              request.transport.driver.state,
            ]
              .filter(Boolean)
              .join(', '),
            photo:
              request.transport.driver.user?.profilePictureUrl ??
              request.transport.driver.user?.profilePicture?.url ??
              null,
          }
        : null,
      transportId: request.transport?.id ?? request.transportId ?? null,
      requestedAt: this.formatDateTime(
        request.requestedAt || request.createdAt,
      ),
      createdAt: request.requestedAt || request.createdAt,
      cancelledAt: request.cancelledAt ?? null,
    };
  }

  private formatInterestDetail(
    interest: any,
    previousHistory: any[] = [],
    transport: any = null,
  ) {
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
            age: interest.animal.age || 'Unknown',
            weight: interest.animal.weight || 'Unknown',
            size: interest.animal.size || 'medium',
          }
        : null,
      healthInfo: {
        spayNeuterAvailable: interest.animal?.spayNeuterStatus === 'YES',
        spayNeuterDate: null,
        spayNeuterNextDate: null,
        lastCheckupDate: null,
        vaccinationsDate: null,
      },
      petPersonality: interest.animal?.behaviorNotes,
      specialNote: interest.animal?.specialNeeds,
      shelterName: interest.animal?.shelter?.name || 'Unknown',
      estimateTransportDate: interest.preferredArrivalDate,
      fosterUser: interest.foster?.user
        ? {
            id: interest.foster.user.id,
            name: interest.foster.user.name,
            avatar: interest.foster.user.profilePictureUrl,
            experienceLabel:
              interest.foster.experienceLevel ?? 'Experienced foster',
            email: interest.foster.user.email,
            phone: interest.foster.phone || 'Not provided',
            location,
            preferences: {
              animalTypes: interest.foster.animalType,
              ageRange: interest.foster.age,
              locationRadius: `${interest.foster.preferredMile || 25}+mi in`,
            },
            previousFosterHistory: previousHistory,
          }
        : null,
      location,
      driver: transport?.driver
        ? {
            id: transport.driver.id,
            name: transport.driver.user?.name ?? 'Unknown',
            email: transport.driver.user?.email ?? 'Not provided',
            phone: transport.driver.phone || 'Not provided',
            location: [transport.driver.address, transport.driver.state]
              .filter(Boolean)
              .join(', '),
            photo:
              transport.driver.user?.profilePictureUrl ??
              transport.driver.user?.profilePicture?.url ??
              null,
          }
        : null,
      transportId: transport?.id ?? null,
      requestedAt: this.formatDateTime(interest.createdAt),
      createdAt: interest.createdAt,
      cancelledAt: interest.cancelledAt ?? null,
    };
  }

  private toClientStatus(status: FosterRequestStatus) {
    return status.toLowerCase();
  }

  private toDisplayStatus(status: FosterRequestStatus) {
    return status === FosterRequestStatus.DELIVERED ||
      status === FosterRequestStatus.COMPLETED
      ? 'completed'
      : this.toClientStatus(status);
  }

  private toDisplayStatusFromInterest(status: FosterInterestStatus) {
    const map: Record<FosterInterestStatus, string> = {
      INTERESTED: 'Interested',
      APPROVED: 'Approved',
      SCHEDULED: 'Scheduled',
      REJECTED: 'Rejected',
      WITHDRAWN: 'Cancelled',
      COMPLETED: 'Completed',
    };
    return map[status] || status.toLowerCase();
  }

  private formatDateTime(value?: Date | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
      .format(value)
      .replace(',', ' at')
      .replace(' at ', ' at ');
  }

  private formatDateOnly(value?: Date | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(value);
  }

  private flattenFoster = (foster: FosterWithUser) => ({
    fosterId: foster.id,
    userId: foster.user.id,
    fullName: foster.user.name,
    email: foster.user.email,
    role: foster.user.role,
    profilePictureUrl: foster.user.profilePictureUrl,
    phone: foster.phone,
    city: foster.city,
    state: foster.state,
    address: foster.address,
    animalType: foster.animalType,
    sizePreference: foster.sizePreference,
    age: foster.age,
    experienceLevel: foster.experienceLevel,
    preferredLocation: foster.preferredLocation,
    preferredMile: foster.preferredMile,
    status: foster.status,
    createdAt: foster.createdAt,
    updatedAt: foster.updatedAt,
  });
}
