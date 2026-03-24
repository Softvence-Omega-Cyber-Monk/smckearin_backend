import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
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
    const foster = await this.prisma.client.foster.findUniqueOrThrow({
      where: { id: fosterId },
      include: {
        user: {
          include: {
            profilePicture: true,
          },
        },
      },
    });

    return successResponse(this.flattenFoster(foster), 'Foster found');
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
    preferredLocation: foster.preferredLocation,
    preferredMile: foster.preferredMile,
    status: foster.status,
    createdAt: foster.createdAt,
    updatedAt: foster.updatedAt,
  });
}
