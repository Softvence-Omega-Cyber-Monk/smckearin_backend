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
      return successResponse(this.flattenFoster(foster), 'Foster found');
    }

    // 2. Check if it's a FosterAnimalInterest ID
    const interest = await this.prisma.client.fosterAnimalInterest.findUnique({
      where: { id },
      include: {
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
      },
    });

    if (interest?.foster) {
      return successResponse(
        this.formatInterestListItem(interest),
        'Foster found',
      );
    }

    // 3. Check if it's a FosterRequest ID
    const request = await this.prisma.client.fosterRequest.findUnique({
      where: { id },
      include: {
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
      },
    });

    if (request) {
      return successResponse(this.formatListItem(request), 'Foster found');
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
      requestedAt: this.formatDateTime(
        request.requestedAt || request.createdAt,
      ),
      createdAt: request.requestedAt || request.createdAt,
      cancelledAt: request.cancelledAt ?? null,
      note: request.shelterNote || request.petPersonality || null,
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
