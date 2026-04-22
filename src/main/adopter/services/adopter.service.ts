import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AdoptionStatus, Prisma, SPECIES } from '@prisma';
import { DateTime } from 'luxon';
import {
  AdopterSpeciesFilter,
  GetAvailableAdoptionsDto,
  GetAvailableAnimalsDto,
  GetMyRequestsDto,
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
      status: 'AVAILABLE',
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
      const searchTerm = dto.search.trim();
      const searchOR: Prisma.AnimalWhereInput[] = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { breed: { contains: searchTerm, mode: 'insensitive' } },
        { sid: { contains: searchTerm, mode: 'insensitive' } },
        { externalAnimalId: { contains: searchTerm, mode: 'insensitive' } },
      ];

      if (searchTerm.toLowerCase() === 'dog') {
        searchOR.push({ species: 'DOG' });
      } else if (searchTerm.toLowerCase() === 'cat') {
        searchOR.push({ species: 'CAT' });
      }

      animalWhere.OR = searchOR;
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
  async getMyRequests(userId: string, dto: GetMyRequestsDto) {
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

    if (dto.search) {
      const searchTerm = dto.search.trim();
      const searchOR: Prisma.AnimalWhereInput[] = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { breed: { contains: searchTerm, mode: 'insensitive' } },
        { sid: { contains: searchTerm, mode: 'insensitive' } },
        { externalAnimalId: { contains: searchTerm, mode: 'insensitive' } },
      ];

      if (searchTerm.toLowerCase() === 'dog') {
        searchOR.push({ species: 'DOG' });
      } else if (searchTerm.toLowerCase() === 'cat') {
        searchOR.push({ species: 'CAT' });
      }

      where.adoption = {
        animal: {
          OR: searchOR,
        },
      };
    }

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

  @HandleError('Failed to fetch shelter available animals')
  async getShelterAvailableAnimals(
    userId: string,
    dto: GetAvailableAnimalsDto,
  ) {
    const shelterId = await this.getShelterId(userId);

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalWhereInput = {
      shelterId,
      adoption: { is: null },
    };

    if (dto.species && dto.species !== AdopterSpeciesFilter.ALL) {
      if (dto.species === AdopterSpeciesFilter.OTHERS) {
        where.species = 'OTHER';
      } else {
        where.species = dto.species.toUpperCase() as SPECIES;
      }
    }

    if (dto.search) {
      const searchTerm = dto.search.trim();
      const searchOR: Prisma.AnimalWhereInput[] = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { breed: { contains: searchTerm, mode: 'insensitive' } },
        { sid: { contains: searchTerm, mode: 'insensitive' } },
        { externalAnimalId: { contains: searchTerm, mode: 'insensitive' } },
      ];

      if (searchTerm.toLowerCase() === 'dog') {
        searchOR.push({ species: 'DOG' });
      } else if (searchTerm.toLowerCase() === 'cat') {
        searchOR.push({ species: 'CAT' });
      }

      where.OR = searchOR;
    }

    const [animals, total] = await this.prisma.client.$transaction([
      this.prisma.client.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { image: true },
      }),
      this.prisma.client.animal.count({ where }),
    ]);

    return successPaginatedResponse(
      animals,
      { page, limit, total },
      'Available animals for adoption fetched successfully',
    );
  }

  @HandleError('Failed to delete adoption record')
  async deleteAdoption(userId: string, id: string) {
    const shelterId = await this.getShelterId(userId);

    const adoption = await this.prisma.client.adoption.findFirst({
      where: { id, shelterId },
    });

    if (!adoption) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adoption record not found');
    }

    await this.prisma.client.adoption.delete({
      where: { id },
    });

    return successResponse(null, 'Adoption record deleted successfully');
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

  @HandleError('Failed to fetch requests count')
  async getRequestsCount(userId: string) {
    const adopter = await this.prisma.client.adopter.findUnique({
      where: { userId },
    });

    if (!adopter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adopter profile not found');
    }

    const count = await this.prisma.client.adoptionRequest.count({
      where: { adopterId: adopter.id, status: AdoptionStatus.REQUESTED },
    });

    return successResponse({ count }, 'Requests count fetched successfully');
  }

  @HandleError('Failed to fetch adoption details for adopter')
  async getAdoptionDetailsForAdopter(id: string) {
    // Try to find as AdoptionRequest first
    const request = await this.prisma.client.adoptionRequest.findUnique({
      where: { id },
      include: {
        adoption: {
          include: {
            animal: {
              include: { image: true },
            },
            shelter: true,
          },
        },
      },
    });

    if (request) {
      return successResponse(
        this.formatAdoptionDetail(request.adoption, request),
        'Adoption request details fetched successfully',
      );
    }

    // Fallback if ID is Adoption ID (though endpoint name suggests Request ID)
    const adoption = await this.prisma.client.adoption.findUnique({
      where: { id },
      include: {
        animal: {
          include: { image: true },
        },
        shelter: true,
      },
    });

    if (!adoption) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'Adoption request or record not found',
      );
    }

    return successResponse(
      this.formatAdoptionDetail(adoption),
      'Adoption details fetched successfully',
    );
  }

  @HandleError('Failed to fetch available adoption details')
  async getAvailableAdoptionDetails(id: string) {
    const adoption = await this.prisma.client.adoption.findUnique({
      where: { id },
      include: {
        animal: {
          include: { image: true },
        },
        shelter: true,
      },
    });

    if (!adoption) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adoption record not found');
    }

    return successResponse(
      this.formatAdoptionDetail(adoption),
      'Available adoption details fetched successfully',
    );
  }

  private formatAdoptionDetail(adoption: any, request?: any) {
    const animal = adoption.animal;
    const shelter = adoption.shelter;

    const details: any = {
      animal: {
        id: animal.id,
        sid: animal.sid,
        name: animal.name,
        breed: animal.breed,
        location:
          shelter.city && shelter.state
            ? `${shelter.city}, ${shelter.state}`
            : 'Unknown',
        age: `${animal.age} years`,
        weight: `${animal.weight} lbs`,
        size: this.getAnimalSize(animal.weight),
        imageUrl: animal.imageUrl,
      },
      personality: adoption.personality || 'No information provided',
      about: adoption.about || `Learn more about ${animal.name}`,
      healthInformation: {
        spayNeuterDate: adoption.spayNeuterDate
          ? `Yes (${DateTime.fromJSDate(adoption.spayNeuterDate).toFormat('LLL d, yyyy')})`
          : 'No',
        lastCheckUp: adoption.lastCheckupDate
          ? DateTime.fromJSDate(adoption.lastCheckupDate).toFormat(
              'LLL d, yyyy',
            )
          : 'Pending',
        vaccinations: animal.vaccinationsUpToDate ? 'up to date' : 'no',
      },
      shelter: {
        id: shelter.id,
        role: 'SHELTER',
      },
      shelterNotes:
        adoption.specialNote || 'No specific notes from the shelter.',
    };

    if (request) {
      details.requestedInformation = {
        submitted: DateTime.fromJSDate(request.createdAt).toFormat(
          'LLL d, yyyy',
        ),
      };
      details.status = request.status;
    } else {
      details.status = adoption.status;
    }

    return details;
  }

  private getAnimalSize(weight: number) {
    if (weight < 20) return 'small';
    if (weight <= 50) return 'medium';
    return 'large';
  }

  @HandleError('Failed to fetch adoptions count')
  async getAdoptionsCount(userId: string) {
    const adopter = await this.prisma.client.adopter.findUnique({
      where: { userId },
    });

    if (!adopter) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Adopter profile not found');
    }

    const count = await this.prisma.client.adoption.count({
      where: { adopterId: adopter.id, status: AdoptionStatus.ADOPTED },
    });

    return successResponse({ count }, 'Adoptions count fetched successfully');
  }
}
