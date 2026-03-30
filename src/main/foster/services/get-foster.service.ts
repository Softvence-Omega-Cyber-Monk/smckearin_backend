import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApprovalStatus, Foster, Prisma, User } from '@prisma';
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
  async getSingleFoster(fosterId: string) {
    // 1. Check if it's a direct Foster ID
    const foster = await this.prisma.client.foster.findUnique({
      where: { id: fosterId },
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
      where: { id: fosterId },
      include: {
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

    if (interest?.foster) {
      return successResponse(
        this.flattenFoster(interest.foster as any),
        'Foster found',
      );
    }

    // 3. Check if it's a FosterRequest ID
    const request = await this.prisma.client.fosterRequest.findUnique({
      where: { id: fosterId },
      include: {
        fosterUser: {
          include: {
            fosters: {
              include: {
                user: {
                  include: {
                    profilePicture: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (request?.fosterUser?.fosters) {
      // In FosterRequest, fosterUser is a User, so we need to adjust flattening
      // but request.fosterUser.fosters should have the foster profile
      return successResponse(
        this.flattenFoster(request.fosterUser.fosters as any),
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
