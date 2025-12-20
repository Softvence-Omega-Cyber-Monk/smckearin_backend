import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetSingleTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get transport')
  async getSingleTransport(id: string) {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id },
      include: {
        animal: true,
        bondedPair: true,
        driver: { include: { user: true } },
        vet: { include: { user: true } },
        shelter: true,
        transportTimelines: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Transform for frontend-friendly output
    const transformed = {
      id: transport.id,
      transportNote: transport.transportNote,
      priority: transport.priorityLevel,
      status: transport.status,
      vetClearanceRequired: transport.isVetClearanceRequired,
      vetClearanceType: transport.vetClearanceType,

      // Animal info
      animal: transport.animal
        ? {
            id: transport.animal.id,
            name: transport.animal.name,
            species: transport.animal.species,
            breed: transport.animal.breed,
            gender: transport.animal.gender,
            status: transport.animal.status,
          }
        : null,

      // Bonded pair
      bondedPair: transport.bondedPair
        ? {
            id: transport.bondedPair.id,
            name: transport.bondedPair.name,
            species: transport.bondedPair.species,
            breed: transport.bondedPair.breed,
            gender: transport.bondedPair.gender,
            status: transport.bondedPair.status,
          }
        : null,

      // Driver info
      driver: transport.driver
        ? {
            id: transport.driver.id,
            name: transport.driver.user?.name ?? null,
            email: transport.driver.user?.email ?? null,
            profilePictureUrl: transport.driver.user?.profilePictureUrl ?? null,
            phone: transport.driver.phone,
            vehicleType: transport.driver.vehicleType,
            vehicleCapacity: transport.driver.vehicleCapacity,
            yearsOfExperience: transport.driver.yearsOfExperience,
          }
        : null,

      // Vet info
      vet: transport.vet
        ? {
            id: transport.vet.id,
            name: transport.vet.user?.name ?? null,
            email: transport.vet.user?.email ?? null,
            profilePictureUrl: transport.vet.user?.profilePictureUrl ?? null,
            phone: transport.vet.phone ?? null,
            license: transport.vet.license ?? null,
            description: transport.vet.description ?? null,
          }
        : null,

      // Shelter info
      shelter: transport.shelter
        ? {
            id: transport.shelter.id,
            name: transport.shelter.name,
            address: transport.shelter.address,
            phone: transport.shelter.phone,
            description: transport.shelter.description,
            logoUrl: transport.shelter.logoUrl,
          }
        : null,

      // Route info
      route: {
        from: {
          location: transport.pickUpLocation,
          latitude: transport.pickUpLatitude,
          longitude: transport.pickUpLongitude,
        },
        to: {
          location: transport.dropOffLocation,
          latitude: transport.dropOffLatitude,
          longitude: transport.dropOffLongitude,
        },
      },

      // Transport timeline
      timeline: transport.transportTimelines.map((t) => ({
        status: t.status,
        note: t.note ?? null,
        latitude: t.latitude ?? null,
        longitude: t.longitude ?? null,
        changedAt: t.createdAt,
      })),

      // Transport timing
      transportDate: transport.transPortDate,
      createdAt: transport.createdAt,
      updatedAt: transport.updatedAt,
    };

    return successResponse(transformed, 'Transport found');
  }
}
