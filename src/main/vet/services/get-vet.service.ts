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
  FileInstance,
  Prisma,
  User,
  VetDocument,
  Veterinarian,
} from '@prisma';
import { GetApprovedVets, GetVetsDto } from '../dto/get-vets.dto';

type VetWithRelations = Veterinarian & {
  user: User;
  vetDocuments: (VetDocument & {
    document: FileInstance;
  })[];
};

@Injectable()
export class GetVetService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get vets')
  async getAllVets(dto: GetVetsDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.VeterinarianWhereInput = {};

    // Apply search to related user info as well as vet fields
    if (dto.search) {
      where.OR = [
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
        { user: { email: { contains: dto.search, mode: 'insensitive' } } },
        { phone: { contains: dto.search, mode: 'insensitive' } },
        { license: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    // Filter by approval status
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

    const [vets, total] = await this.prisma.client.$transaction([
      this.prisma.client.veterinarian.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          vetDocuments: {
            include: {
              document: true,
            },
          },
        },
      }),
      this.prisma.client.veterinarian.count({ where }),
    ]);

    const flattenedVets = vets.map(this.flattenVet);

    return successPaginatedResponse(
      flattenedVets,
      { page, limit, total },
      'Vets found',
    );
  }

  @HandleError('Failed to get approved vets')
  async getApprovedVets(dto: GetApprovedVets) {
    return this.getAllVets({ ...dto, status: 'APPROVED' });
  }

  @HandleError('Failed to get single vet')
  async getSingleVet(vetId: string) {
    const vet: VetWithRelations =
      await this.prisma.client.veterinarian.findUniqueOrThrow({
        where: { id: vetId },
        include: {
          user: true,
          vetDocuments: {
            include: {
              document: true,
            },
          },
        },
      });

    const flattenedVet = this.flattenVet(vet);

    return successResponse(flattenedVet, 'Vet found');
  }

  @HandleError('Failed to get own vet documents')
  async getOwnVetDocuments(userId: string) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
      include: {
        vetDocuments: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!vet) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Vet profile not found');
    }

    const globalStatus = this.getGlobalVetStatus(vet.status, vet.vetDocuments);

    return successResponse(
      {
        vetStatus: globalStatus.status,
        vetStatusDescription: globalStatus.description,
        documents: vet.vetDocuments.map((doc) => ({
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

  private flattenVet = (vet: VetWithRelations) => {
    return {
      id: vet.id,
      userId: vet.user.id,
      name: vet.user.name,
      email: vet.user.email,
      phone: vet.phone,
      license: vet.license,
      description: vet.description,
      startTime: vet.startTime,
      endTime: vet.endTime,
      status: vet.status,
      createdAt: vet.createdAt,
      updatedAt: vet.updatedAt,
      documents:
        vet.vetDocuments?.map((doc) => ({
          documentId: doc.id,
          fileId: doc.documentId,
          url: doc.documentUrl,
          name: doc.name,
          type: doc.type,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          mimeType: doc.document?.mimeType ?? null,
          size: doc.document?.size ?? null,
          originalName: doc.document?.originalFilename ?? null,
        })) ?? [],
    };
  };

  private getGlobalVetStatus(
    vetStatus: ApprovalStatus,
    documents: { status: ApprovalStatus }[],
  ): {
    status: string;
    description: string;
  } {
    if (
      vetStatus === ApprovalStatus.REJECTED ||
      documents.some((d) => d.status === ApprovalStatus.REJECTED)
    ) {
      return {
        status: 'REJECTED',
        description:
          'Your verification was rejected. Please review and resubmit documents.',
      };
    }

    const allApproved =
      vetStatus === ApprovalStatus.APPROVED &&
      documents.length > 0 &&
      documents.every((d) => d.status === ApprovalStatus.APPROVED);

    if (allApproved) {
      return {
        status: 'APPROVED',
        description: 'Your profile is verified and approved.',
      };
    }

    if (documents.some((d) => d.status === ApprovalStatus.PENDING)) {
      return {
        status: 'UNDER_REVIEW',
        description:
          'Your profile is under review. We are verifying your documents.',
      };
    }

    return {
      status: 'PENDING',
      description:
        'Your profile is incomplete. Please submit required documents.',
    };
  }
}
