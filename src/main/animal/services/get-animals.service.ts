import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import { GetAnimalDto, GetPendingAnimalDto } from '../dto/get-animal.dto';

@Injectable()
export class GetAnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Can't get animals")
  async getAnimals(userId: string, dto: GetAnimalDto) {
    // Fetch user and associated shelter
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        shelterAdminOfId: true,
        managerOfId: true,
      },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;

    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalWhereInput = {
      shelterId,
    };

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { breed: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.species) {
      where.species = dto.species;
    }

    if (dto.gender) {
      where.gender = dto.gender;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    const [animals, total] = await this.prisma.client.$transaction([
      this.prisma.client.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.animal.count({ where }),
    ]);

    return successPaginatedResponse(
      animals,
      { page, limit, total },
      'Animals fetched',
    );
  }

  @HandleError("Can't get pending animals")
  async getPendingAnimals(userId: string, dto: GetPendingAnimalDto) {
    // Fetch user and associated shelter
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    // Fetch animals that are available for transport
    const where: Prisma.AnimalWhereInput = {
      shelterId,
      status: 'AT_SHELTER', // Only animals currently at the shelter
    };

    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const search = dto.search;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { breed: { contains: search, mode: 'insensitive' } },
      ];
    }

    const animals = await this.prisma.client.animal.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' }, // sort alphabetically for autocomplete
    });

    return successResponse(animals, 'Pending animals fetched');
  }

  @HandleError("Can't get animals available for foster")
  async getAnimalsAvailableForFoster(userId: string, dto: GetPendingAnimalDto) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { shelterAdminOfId: true, managerOfId: true },
    });

    const shelterId = user.shelterAdminOfId ?? user.managerOfId;
    if (!shelterId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'User does not belong to any shelter',
      );
    }

    const where: Prisma.AnimalWhereInput = {
      shelterId,
      status: 'AT_SHELTER',
      fosterRequests: {
        none: {
          status: {
            in: ['REQUESTED', 'INTERESTED', 'APPROVED', 'SCHEDULED'],
          },
        },
      },
    };

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { breed: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const animals = await this.prisma.client.animal.findMany({
      where,
      take: dto.limit && +dto.limit > 0 ? +dto.limit : 20,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        breed: true,
        species: true,
        gender: true,
        age: true,
        imageUrl: true,
        shelterId: true,
      },
    });

    return successResponse(
      {
        total: animals.length,
        data: animals.map((animal) => ({
          id: animal.id,
          name: animal.name,
          photo: animal.imageUrl,
          breed: animal.breed,
          type: animal.species,
          gender: animal.gender,
          age: animal.age,
        })),
      },
      'Animals available for foster fetched successfully',
    );
  }

  @HandleError("Can't get single animal")
  async getSingleAnimal(animalId: string) {
    const animal = await this.prisma.client.animal.findUniqueOrThrow({
      where: { id: animalId },
      include: {
        image: true,
        shelter: true,
        healthReports: true,
      },
    });

    return successResponse(animal, 'Animal found');
  }

  @HandleError("Can't get all animals system-wide")
  async getAllAnimalsSystemWide(dto: GetAnimalDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalWhereInput = {};

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { breed: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.species) where.species = dto.species;
    if (dto.gender) where.gender = dto.gender;
    if (dto.status) where.status = dto.status;

    const [animals, total] = await this.prisma.client.$transaction([
      this.prisma.client.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.animal.count({ where }),
    ]);

    return successPaginatedResponse(
      animals,
      { page, limit, total },
      'All animals fetched system-wide',
    );
  }
}
