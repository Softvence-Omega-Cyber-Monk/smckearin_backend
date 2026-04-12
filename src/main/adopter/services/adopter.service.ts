import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SPECIES } from '@prisma';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  AdopterSpeciesFilter,
  GetAvailableAdoptionsDto,
  GetShelterAdoptionsDto,
  ShelterAdoptionFilter,
  SubmitAdoptionRequestDto,
} from '../dto/adoption-filter.dto';
import { CreateAdoptionDto } from '../dto/create-adoption.dto';

@Injectable()
export class AdopterService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to create adoption')
  async createAdoption(userId: string, dto: CreateAdoptionDto) {
    // 1. Get the shelter associated with the user
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with any shelter',
      );
    }

    // 2. Check if all animals exist and belong to the shelter
    const animals = await this.prisma.client.animal.findMany({
      where: {
        id: { in: dto.animalIds },
        shelterId: shelterId,
      },
    });

    if (animals.length !== dto.animalIds.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'One or more animals not found or do not belong to your shelter',
      );
    }

    // 3. Check for existing adoptions to avoid unique constraint violations
    const existingAdoptions = await this.prisma.client.adoption.findMany({
      where: {
        animalId: { in: dto.animalIds },
      },
      select: { animalId: true },
    });

    if (existingAdoptions.length > 0) {
      const existingIds = existingAdoptions.map((a) => a.animalId);
      throw new AppError(
        HttpStatus.CONFLICT,
        `Adoption records already exist for these animal IDs: ${existingIds.join(', ')}`,
      );
    }

    // 4. Create adoption records in a transaction
    const adoptions = await this.prisma.client.$transaction(
      dto.animalIds.map((animalId) =>
        this.prisma.client.adoption.create({
          data: {
            animalId,
            shelterId: shelterId,
            spayNeuterAvailable: dto.spayNeuterAvailable ?? false,
            spayNeuterDate: dto.spayNeuterDate
              ? new Date(dto.spayNeuterDate)
              : null,
            lastCheckupDate: dto.lastCheckupDate
              ? new Date(dto.lastCheckupDate)
              : null,
            vaccinationsDate: dto.vaccinationsDate
              ? new Date(dto.vaccinationsDate)
              : null,
            personality: dto.personality,
            about: dto.about,
            specialNote: dto.specialNote,
            status: 'AVAILABLE',
          },
          include: {
            animal: true,
            adopter: true,
            shelter: true,
          },
        }),
      ),
    );

    return successResponse(
      adoptions,
      `${adoptions.length} adoption(s) created successfully`,
    );
  }

  // --- Shelter Panel ---

  @HandleError('Failed to fetch shelter adoptions')
  async getShelterAdoptions(userId: string, dto: GetShelterAdoptionsDto) {
    const shelterId = await this.getShelterId(userId);

    const where: Prisma.AdoptionWhereInput = { shelterId };

    if (dto.filter === ShelterAdoptionFilter.AVAILABLE) {
      where.status = 'AVAILABLE';
    } else if (dto.filter === ShelterAdoptionFilter.REQUESTED) {
      where.status = 'REQUESTED';
    } else if (dto.filter === ShelterAdoptionFilter.ADOPTED) {
      where.status = 'ADOPTED';
    }

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const [adoptions, total] = await this.prisma.client.$transaction([
      this.prisma.client.adoption.findMany({
        where,
        skip,
        take: limit,
        include: {
          animal: true,
          requests: {
            include: {
              adopter: { include: { user: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.adoption.count({ where }),
    ]);

    return successPaginatedResponse(
      adoptions,
      { page, limit, total },
      'Adoptions fetched successfully',
    );
  }

  @HandleError('Failed to fetch adoption details')
  async getAdoptionDetails(userId: string, id: string) {
    const shelterId = await this.getShelterId(userId);

    const adoption = await this.prisma.client.adoption.findFirst({
      where: { id, shelterId },
      include: {
        animal: true,
        requests: {
          include: {
            adopter: { include: { user: true } },
          },
        },
      },
    });

    if (!adoption) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adoption record not found');
    }

    return successResponse(adoption, 'Adoption details fetched successfully');
  }

  @HandleError('Failed to approve adoption request')
  async approveAdoptionRequest(userId: string, requestId: string) {
    const shelterId = await this.getShelterId(userId);

    const request = await this.prisma.client.adoptionRequest.findFirst({
      where: { id: requestId, adoption: { shelterId } },
      include: { adoption: true },
    });

    if (!request) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adoption request not found');
    }

    // Approve this request and mark adoption as ADOPTED
    await this.prisma.client.$transaction([
      this.prisma.client.adoptionRequest.update({
        where: { id: requestId },
        data: { status: 'ADOPTED' as any },
      }),
      this.prisma.client.adoption.update({
        where: { id: request.adoptionId },
        data: {
          status: 'ADOPTED' as any,
          adopterId: request.adopterId,
        },
      }),
      // Reject other requests for the same animal
      this.prisma.client.adoptionRequest.updateMany({
        where: {
          adoptionId: request.adoptionId,
          id: { not: requestId },
        },
        data: { status: 'REJECTED' },
      }),
    ]);

    return successResponse(null, 'Adoption request approved successfully');
  }

  @HandleError('Failed to reject adoption request')
  async rejectAdoptionRequest(userId: string, requestId: string) {
    const shelterId = await this.getShelterId(userId);

    const request = await this.prisma.client.adoptionRequest.updateMany({
      where: { id: requestId, adoption: { shelterId } },
      data: { status: 'REJECTED' },
    });

    if (request.count === 0) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adoption request not found');
    }

    return successResponse(null, 'Adoption request rejected successfully');
  }

  // --- Adopter Panel ---

  @HandleError('Failed to fetch available adoptions')
  async getAvailableAdoptions(dto: GetAvailableAdoptionsDto) {
    const where: Prisma.AdoptionWhereInput = {
      status: { in: ['AVAILABLE', 'REQUESTED'] },
    };

    const animalWhere: Prisma.AnimalWhereInput = {};

    if (dto.species && dto.species !== AdopterSpeciesFilter.ALL) {
      if (dto.species === AdopterSpeciesFilter.OTHERS) {
        animalWhere.species = 'OTHER';
      } else {
        animalWhere.species = dto.species.toUpperCase() as SPECIES;
      }
    }

    if (dto.search) {
      animalWhere.name = { contains: dto.search, mode: 'insensitive' };
    }

    if (Object.keys(animalWhere).length > 0) {
      where.animal = animalWhere;
    }

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const [adoptions, total] = await this.prisma.client.$transaction([
      this.prisma.client.adoption.findMany({
        where,
        skip,
        take: limit,
        include: {
          animal: true,
          shelter: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.adoption.count({ where }),
    ]);

    return successPaginatedResponse(
      adoptions,
      { page, limit, total },
      'Available animals fetched successfully',
    );
  }

  @HandleError('Failed to submit adoption request')
  async submitAdoptionRequest(userId: string, dto: SubmitAdoptionRequestDto) {
    const adopter = await this.prisma.client.adopter.findUnique({
      where: { userId },
    });

    if (!adopter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adopter profile not found');
    }

    const adoption = await this.prisma.client.adoption.findUnique({
      where: { id: dto.adoptionId },
    });

    if (!adoption || !['AVAILABLE', 'REQUESTED'].includes(adoption.status)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'This animal is no longer available for adoption',
      );
    }

    const existingRequest = await this.prisma.client.adoptionRequest.findFirst({
      where: {
        adoptionId: dto.adoptionId,
        adopterId: adopter.id,
      },
    });

    if (existingRequest) {
      throw new AppError(
        HttpStatus.CONFLICT,
        'You have already submitted a request for this animal',
      );
    }

    const [request] = await this.prisma.client.$transaction([
      this.prisma.client.adoptionRequest.create({
        data: {
          adoptionId: dto.adoptionId,
          adopterId: adopter.id,
          note: dto.note,
          status: 'REQUESTED' as any,
        },
      }),
      this.prisma.client.adoption.update({
        where: { id: dto.adoptionId },
        data: { status: 'REQUESTED' },
      }),
    ]);

    return successResponse(request, 'Adoption request submitted successfully');
  }

  @HandleError('Failed to fetch my requests')
  async getMyRequests(userId: string, dto: PaginationDto) {
    const adopter = await this.prisma.client.adopter.findUnique({
      where: { userId },
    });

    if (!adopter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adopter profile not found');
    }

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AdoptionRequestWhereInput = { adopterId: adopter.id };

    const [requests, total] = await this.prisma.client.$transaction([
      this.prisma.client.adoptionRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          adoption: {
            include: {
              animal: true,
              shelter: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.adoptionRequest.count({ where }),
    ]);

    return successPaginatedResponse(
      requests,
      { page, limit, total },
      'Your requests fetched successfully',
    );
  }

  private async getShelterId(userId: string): Promise<string> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, 'User not found');
    }

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User is not associated with any shelter',
      );
    }

    return shelterId;
  }
}
