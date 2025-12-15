import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  Animal,
  ApprovalStatus,
  FileInstance,
  Prisma,
  Shelter,
  ShelterDocument,
  Transport,
  User,
} from '@prisma';
import { GetApprovedShelters, GetSheltersDto } from '../dto/get-shelters.dto';

type ShelterWithRelations = Shelter & {
  logo: FileInstance | null;
  shelterDocuments: (ShelterDocument & {
    document: FileInstance;
  })[];
  shelterAdmins: User[];
  managers: User[];
  animals: Animal[];
  transports: Transport[];
};

@Injectable()
export class GetShelterService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get shelters')
  async getAllShelters(dto: GetSheltersDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ShelterWhereInput = {};

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { address: { contains: dto.search, mode: 'insensitive' } },
        { phone: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.status) {
      const allowedStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED',
      ] as ApprovalStatus[];
      const statusUpper = dto.status.toUpperCase();

      if (allowedStatuses.includes(statusUpper as any)) {
        where.status = statusUpper as ApprovalStatus;
      }
    }

    const [shelters, total] = await this.prisma.client.$transaction([
      this.prisma.client.shelter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          logo: true,
          shelterDocuments: {
            include: {
              document: true,
            },
          },
          shelterAdmins: true,
          managers: true,
        },
      }),
      this.prisma.client.shelter.count({ where }),
    ]);

    const flattenedShelters = shelters.map(this.flattenShelter);

    return successPaginatedResponse(
      flattenedShelters,
      { page, limit, total },
      'Shelters found',
    );
  }

  @HandleError('Failed to get approved shelters')
  async getApprovedShelters(dto: GetApprovedShelters) {
    return this.getAllShelters({ ...dto, status: 'APPROVED' });
  }

  @HandleError('Failed to get single shelter')
  async getSingleShelter(shelterId: string) {
    const shelter: ShelterWithRelations =
      await this.prisma.client.shelter.findUniqueOrThrow({
        where: { id: shelterId },
        include: {
          logo: true,
          shelterDocuments: {
            include: {
              document: true,
            },
          },
          shelterAdmins: true,
          managers: true,
          animals: true,
          transports: true,
        },
      });

    const flattenedShelter = this.flattenShelter(shelter);

    return successResponse(flattenedShelter, 'Shelter found');
  }

  private flattenShelter = (shelter: ShelterWithRelations) => {
    return {
      id: shelter.id,
      name: shelter.name ?? 'N/A',
      address: shelter.address ?? 'N/A',
      phone: shelter.phone ?? 'N/A',
      description: shelter.description ?? 'N/A',
      logoUrl: shelter.logoUrl,
      startTime: shelter.startTime,
      endTime: shelter.endTime,
      status: shelter.status,
      createdAt: shelter.createdAt,
      updatedAt: shelter.updatedAt,
      admins: shelter.shelterAdmins.map((admin) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
      })),
      managers: shelter.managers.map((manager) => ({
        id: manager.id,
        name: manager.name,
        email: manager.email,
      })),
      documents: shelter.shelterDocuments.map((doc) => ({
        documentId: doc.documentId,
        url: doc.documentUrl,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        mimeType: doc.document.mimeType,
        size: doc.document.size,
        originalName: doc.document.originalFilename,
      })),
      animals: shelter.animals.map((animal) => ({
        id: animal.id,
        name: animal.name,
        species: animal.species,
        breed: animal.breed,
      })),
      transports: shelter.transports.map((transport) => ({
        id: transport.id,
        priorityLevel: transport.priorityLevel,
        transportNote: transport.transportNote,
        pickUpLocation: transport.pickUpLocation,
        pickUpLatitude: transport.pickUpLatitude,
        pickUpLongitude: transport.pickUpLongitude,
        dropOffLocation: transport.dropOffLocation,
        dropOffLatitude: transport.dropOffLatitude,
        dropOffLongitude: transport.dropOffLongitude,
      })),
      animalsNumber: shelter.animals.length,
      transportsNumber: shelter.transports.length,
    };
  };
}
