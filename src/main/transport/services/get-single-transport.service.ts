import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { JWTPayload } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetSingleTransportService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get transport')
  async getSingleTransport(id: string, authUser?: JWTPayload) {
    const transport = await this.prisma.client.transport.findUniqueOrThrow({
      where: { id },
      include: {
        animals: true,
        bondedPair: true,
        driver: { include: { user: true } },
        vet: { include: { user: true } },
        shelter: true,
        transportTimelines: { orderBy: { createdAt: 'asc' } },
        legs: {
          include: {
            driver: {
              include: {
                user: {
                  select: { name: true, email: true, profilePictureUrl: true },
                },
              },
            },
          },
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });

    let legsData = transport.isMultiLeg ? transport.legs : [];
    let pickUpLocation = transport.pickUpLocation;
    let pickUpLatitude = transport.pickUpLatitude;
    let pickUpLongitude = transport.pickUpLongitude;

    let dropOffLocation = transport.dropOffLocation;
    let dropOffLatitude = transport.dropOffLatitude;
    let dropOffLongitude = transport.dropOffLongitude;

    let status = transport.status as string;

    let currentDriverId: string | null = null;
    if (transport.isMultiLeg && authUser && authUser.role === 'DRIVER') {
      const driverObj = await this.prisma.client.driver.findUnique({
        where: { userId: authUser.sub },
      });
      if (driverObj) {
        currentDriverId = driverObj.id;
        legsData = legsData.filter((leg) => leg.driverId === driverObj.id);
        const myLeg = transport.legs.find(
          (leg) => leg.driverId === driverObj.id,
        );
        if (myLeg) {
          pickUpLocation = myLeg.pickUpLocation;
          pickUpLatitude = myLeg.pickUpLatitude;
          pickUpLongitude = myLeg.pickUpLongitude;

          dropOffLocation = myLeg.dropOffLocation;
          dropOffLatitude = myLeg.dropOffLatitude;
          dropOffLongitude = myLeg.dropOffLongitude;

          status = myLeg.status as string;

          if (myLeg.driver) {
            transport.driver = myLeg.driver as any;
          }
        }
      }
    }

    // Transform for frontend-friendly output
    const transformed = {
      id: transport.id,
      transportNote: transport.transportNote,
      priority: transport.priorityLevel,
      status: status,
      isMultiLeg: transport.isMultiLeg,
      vetClearanceRequired: transport.isVetClearanceRequired,
      vetClearanceType: transport.vetClearanceType,

      // Animals info
      animals: transport.animals.map((a) => ({
        id: a.id,
        sid: a.sid,
        name: a.name,
        age: a.age,
        species: a.species,
        breed: a.breed,
        gender: a.gender,
        status: a.status,
        photo: a.imageUrl,
      })),

      // Bonded pair
      bondedPair: transport.bondedPair
        ? {
            id: transport.bondedPair.id,
            sid: transport.bondedPair.sid,
            name: transport.bondedPair.name,
            species: transport.bondedPair.species,
            breed: transport.bondedPair.breed,
            gender: transport.bondedPair.gender,
            status: transport.bondedPair.status,
            photo: transport.bondedPair.imageUrl,
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
          location: pickUpLocation,
          latitude: pickUpLatitude,
          longitude: pickUpLongitude,
        },
        to: {
          location: dropOffLocation,
          latitude: dropOffLatitude,
          longitude: dropOffLongitude,
        },
      },

      // Multi-leg info
      legs: transport.isMultiLeg
        ? legsData.map((leg) => ({
            id: leg.id,
            sequenceOrder: leg.sequenceOrder,
            status: leg.status,
            pickUp: {
              location: leg.pickUpLocation,
              latitude: leg.pickUpLatitude,
              longitude: leg.pickUpLongitude,
            },
            dropOff: {
              location: leg.dropOffLocation,
              latitude: leg.dropOffLatitude,
              longitude: leg.dropOffLongitude,
            },
            driver:
              leg.driver &&
              (authUser?.role !== 'DRIVER' || leg.driverId === currentDriverId)
                ? {
                    id: leg.driver.id,
                    name: leg.driver.user?.name ?? null,
                    email: leg.driver.user?.email ?? null,
                    profilePictureUrl:
                      leg.driver.user?.profilePictureUrl ?? null,
                  }
                : null,
            actualPickUpAt: leg.actualPickUpAt,
            actualDropOffAt: leg.actualDropOffAt,
            createdAt: leg.createdAt,
            updatedAt: leg.updatedAt,
          }))
        : [],

      // Transport timeline
      timeline: [
        ...transport.transportTimelines.filter(
          (t) => t.status !== 'IN_TRANSIT',
        ),
        ...(transport.transportTimelines.filter(
          (t) => t.status === 'IN_TRANSIT',
        ).length > 0
          ? [
              transport.transportTimelines.filter(
                (t) => t.status === 'IN_TRANSIT',
              )[0],
              ...(transport.transportTimelines.filter(
                (t) => t.status === 'IN_TRANSIT',
              ).length > 1
                ? [
                    transport.transportTimelines.filter(
                      (t) => t.status === 'IN_TRANSIT',
                    )[
                      transport.transportTimelines.filter(
                        (t) => t.status === 'IN_TRANSIT',
                      ).length - 1
                    ],
                  ]
                : []),
            ]
          : []),
      ]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((t) => ({
          status: t.status,
          note: t.note ?? null,
          latitude: t.latitude ?? null,
          longitude: t.longitude ?? null,
          changedAt: t.createdAt,
        })),

      // Transport timing
      cancellationRequest: transport.cancellationRequestStatus
        ? {
            status: transport.cancellationRequestStatus,
            reason: transport.cancellationRequestReason ?? null,
            reviewNote: transport.cancellationRequestReviewNote ?? null,
            requestedAt: transport.cancellationRequestedAt ?? null,
            reviewedAt: transport.cancellationRequestReviewedAt ?? null,
          }
        : null,

      transportDate: transport.transPortDate,
      createdAt: transport.createdAt,
      updatedAt: transport.updatedAt,
    };

    return successResponse(transformed, 'Transport found');
  }
}
// test
