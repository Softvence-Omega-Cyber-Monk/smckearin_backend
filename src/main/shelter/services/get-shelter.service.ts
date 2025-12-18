import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
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

    const flattenedShelters = shelters?.map(this.flattenShelter);

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

  @HandleError('Failed to get own shelter documents')
  async getOwnShelterDocuments(userId: string) {
    const shelter = await this.prisma.client.shelter.findFirst({
      where: {
        OR: [
          { shelterAdmins: { some: { id: userId } } },
          { managers: { some: { id: userId } } },
        ],
      },
      include: {
        shelterDocuments: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!shelter) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        'Shelter not found for this user',
      );
    }

    const globalStatus = this.getGlobalShelterStatus(
      shelter.status,
      shelter.shelterDocuments,
    );

    return successResponse(
      {
        shelterStatus: globalStatus.status,
        shelterStatusDescription: globalStatus.description,
        documents: shelter.shelterDocuments.map((doc) => ({
          documentId: doc.id,
          fileId: doc.documentId,
          url: doc.documentUrl,
          name: doc.name,
          type: doc.type,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          mimeType: doc.document.mimeType,
          size: doc.document.size,
          originalName: doc.document.originalFilename,
        })),
      },
      'Documents found',
    );
  }

  @HandleError('Failed to get single shelter document')
  async getSingleShelterDocument(documentId: string) {
    const doc = await this.prisma.client.shelterDocument.findUnique({
      where: { id: documentId },
      include: {
        document: true,
      },
    });

    if (!doc) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Document not found');
    }

    return successResponse(
      {
        documentId: doc.id,
        fileId: doc.documentId,
        url: doc.documentUrl,
        name: doc.name,
        type: doc.type,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        mimeType: doc.document.mimeType,
        size: doc.document.size,
        originalName: doc.document.originalFilename,
      },
      'Document found',
    );
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
      managers:
        shelter.managers?.map((manager) => ({
          id: manager.id,
          name: manager.name,
          email: manager.email,
        })) ?? [],
      documents:
        shelter.shelterDocuments?.map((doc) => ({
          documentId: doc.documentId,
          url: doc.documentUrl,
          name: doc.name,
          type: doc.type,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          mimeType: doc.document.mimeType,
          size: doc.document.size,
          originalName: doc.document.originalFilename,
        })) ?? [],
      animals:
        shelter.animals?.map((animal) => ({
          id: animal.id,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
        })) ?? [],
      transports:
        shelter.transports?.map((transport) => ({
          id: transport.id,
          priorityLevel: transport.priorityLevel,
          transportNote: transport.transportNote,
          pickUpLocation: transport.pickUpLocation,
          pickUpLatitude: transport.pickUpLatitude,
          pickUpLongitude: transport.pickUpLongitude,
          dropOffLocation: transport.dropOffLocation,
          dropOffLatitude: transport.dropOffLatitude,
          dropOffLongitude: transport.dropOffLongitude,
        })) ?? [],
      animalsNumber: shelter.animals?.length ?? 0,
      transportsNumber: shelter.transports?.length ?? 0,
    };
  };

  private getGlobalShelterStatus(
    shelterStatus: ApprovalStatus,
    documents: { status: ApprovalStatus }[],
  ): {
    status: string;
    description: string;
  } {
    if (
      shelterStatus === ApprovalStatus.REJECTED ||
      documents.some((d) => d.status === ApprovalStatus.REJECTED)
    ) {
      return {
        status: 'REJECTED',
        description:
          'Your shelter verification was rejected. Please review and resubmit documents.',
      };
    }

    const allApproved =
      shelterStatus === ApprovalStatus.APPROVED &&
      documents.length > 0 &&
      documents.every((d) => d.status === ApprovalStatus.APPROVED);

    if (allApproved) {
      return {
        status: 'APPROVED',
        description: 'Your shelter is verified and approved.',
      };
    }

    if (documents.some((d) => d.status === ApprovalStatus.PENDING)) {
      return {
        status: 'UNDER_REVIEW',
        description:
          'Your shelter is under review. We are verifying your documents.',
      };
    }

    return {
      status: 'PENDING',
      description:
        'Your shelter profile is incomplete. Please submit required documents.',
    };
  }
}
