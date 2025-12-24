import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { TravelMode } from '@googlemaps/google-maps-services-js';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  LiveTrackingResponseDto,
  MilestoneDto,
} from '../dto/live-tracking-response.dto';

@Injectable()
export class GetLiveTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
  ) {}

  @HandleError('Unable to fetch live tracking data')
  async getLiveTracking(transportId: string) {
    const transport = (await this.prisma.client.transport.findUnique({
      where: { id: transportId },
      include: {
        animal: true,
        driver: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })) as any;

    if (!transport) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Transport not found');
    }

    const {
      pickUpLatitude,
      pickUpLongitude,
      dropOffLatitude,
      dropOffLongitude,
      driver,
    } = transport;

    // 1. Determine Driver Connectivity
    let driverConnected = false;
    if (driver?.lastLocationPing) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      driverConnected = driver.lastLocationPing > oneMinuteAgo;
    }

    const currentLat = driver?.currentLatitude ?? pickUpLatitude;
    const currentLng = driver?.currentLongitude ?? pickUpLongitude;

    // 2. Fetch Directions from Google Maps
    const directionsResponse = await this.googleMaps.getClient().directions({
      params: {
        origin: { lat: currentLat, lng: currentLng },
        destination: { lat: dropOffLatitude, lng: dropOffLongitude },
        mode: TravelMode.driving,
        key: this.googleMaps.getApiKey(),
      },
    });

    if (
      directionsResponse.data.status !== 'OK' ||
      !directionsResponse.data.routes[0]
    ) {
      throw new AppError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Unable to calculate route',
      );
    }

    const route = directionsResponse.data.routes[0];
    const leg = route.legs[0];

    // 3. Calculate Progress
    // We also need the total distance from pickup to dropoff to calculate percentile accurately.
    const totalRouteResponse = await this.googleMaps.getClient().directions({
      params: {
        origin: { lat: pickUpLatitude, lng: pickUpLongitude },
        destination: { lat: dropOffLatitude, lng: dropOffLongitude },
        mode: TravelMode.driving,
        key: this.googleMaps.getApiKey(),
      },
    });

    const totalDistance =
      totalRouteResponse.data.routes[0]?.legs[0]?.distance?.value ?? 1; // in meters
    const distanceRemaining = leg.distance.value; // in meters
    const distanceTraveled = Math.max(0, totalDistance - distanceRemaining);
    const progressPercentage = Math.min(
      100,
      (distanceTraveled / totalDistance) * 100,
    );

    // 4. Generate Milestones
    // Milestones are derived from steps or just the destination for now.
    const milestones: MilestoneDto[] = leg.steps.slice(0, 5).map((step) => {
      const stepDistance = step.distance.value;
      const stepDuration = step.duration.value;

      return {
        name: step.html_instructions.replace(/<[^>]*>?/gm, ''), // strip HTML
        distanceFromPickup: distanceTraveled + stepDistance,
        eta: new Date(Date.now() + stepDuration * 1000),
      };
    });

    const response: LiveTrackingResponseDto = {
      transportId: transport.id,
      animalName: transport.animal.name,
      animalBreed: transport.animal.breed,
      primaryAnimalId: transport.animalId,
      bondedAnimalId: transport.bondedPairId ?? undefined,
      status: transport.status,
      pickUpLocation: transport.pickUpLocation,
      dropOffLocation: transport.dropOffLocation,
      currentLatitude: driver?.currentLatitude ?? undefined,
      currentLongitude: driver?.currentLongitude ?? undefined,
      driverConnected,
      lastLocationPing: driver?.lastLocationPing ?? undefined,
      totalDistance: totalDistance / 1609.34, // convert to miles
      distanceRemaining: distanceRemaining / 1609.34, // convert to miles
      progressPercentage,
      estimatedTotalTimeMinutes: leg.duration.value / 60,
      estimatedTimeRemainingMinutes: leg.duration.value / 60,
      estimatedDropoffTime: new Date(Date.now() + leg.duration.value * 1000),
      milestones,
      routePolyline: route.overview_polyline.points,
    };

    return successResponse(response, 'Live tracking data fetched successfully');
  }
}
