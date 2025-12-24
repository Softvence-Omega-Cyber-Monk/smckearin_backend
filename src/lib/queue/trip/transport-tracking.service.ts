import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { errorResponse, successResponse } from '@/common/utils/response.util';
import { simplifyError } from '@/core/error/handle-error.simplify';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { TravelMode } from '@googlemaps/google-maps-services-js';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';
import { TransportLocationUpdateDto } from '../dto/transport-tracking.dto';
import { QueueGateway } from '../queue.gateway';

@Injectable()
export class TransportTrackingService {
  private logger = new Logger(TransportTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
    @Inject(forwardRef(() => QueueGateway))
    private readonly gateway: QueueGateway,
  ) {}

  async updateLocation(client: Socket, payload: TransportLocationUpdateDto) {
    try {
      this.logger.log(`Updating location for transport ${payload.transportId}`);

      const userId = client.data.userId;

      const user = await this.prisma.client.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true },
      });

      const driver = await this.prisma.client.driver.findUniqueOrThrow({
        where: { userId: user.id },
        select: { id: true },
      });

      const driverId = driver?.id;
      const { transportId, latitude, longitude } = payload;

      // check driver ownership
      const transport = await this.prisma.client.transport.findUniqueOrThrow({
        where: { id: transportId },
        select: { driverId: true },
      });

      if (transport?.driverId !== driverId) {
        return errorResponse(null, 'Transport does not belong to this driver');
      }

      // validate location
      const isValid = await this.googleMaps.validateCoordinates(
        latitude,
        longitude,
      );

      if (!isValid) {
        return errorResponse(null, 'Invalid location');
      }

      // 1. Save to TransportTimeline
      await this.prisma.client.transportTimeline.create({
        data: {
          transportId,
          status: 'IN_TRANSIT',
          latitude,
          longitude,
          note: 'Driver live location',
        },
      });

      // 2. Update Driver's current location and last ping
      await this.prisma.client.driver.update({
        where: { id: driverId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationPing: new Date(),
        },
      });

      // 3. Get Enriched Tracking Data
      const liveData = await this.getLiveTrackingData(transportId);

      // 4. Prepare payload
      const eventPayload = successResponse(liveData, 'Location updated');

      // 5. Emit to all connected clients tracking this transport
      this.gateway.emitToRoom(
        `transport-${transportId}`,
        QueueEventsEnum.TRANSPORT_TRACKING_DATA,
        eventPayload,
      );

      return eventPayload;
    } catch (error: any) {
      this.logger.error('Failed to update transport location', error.stack);
      try {
        simplifyError(error, 'Failed to update location', 'Transport');
      } catch (simplifiedError: any) {
        return errorResponse(null, simplifiedError.message);
      }
    }
  }

  async getLiveTrackingData(transportId: string) {
    try {
      this.logger.log(`Fetching live tracking data for ${transportId}`);

      const transport = await this.prisma.client.transport.findUnique({
        where: { id: transportId },
        include: {
          animal: true,
          bondedPair: true,
          driver: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!transport) {
        return errorResponse(null, 'Transport not found');
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
        return errorResponse(null, 'Unable to calculate route');
      }

      const route = directionsResponse.data.routes[0];
      const leg = route.legs[0];

      // 3. Calculate Progress
      const totalRouteResponse = await this.googleMaps.getClient().directions({
        params: {
          origin: { lat: pickUpLatitude, lng: pickUpLongitude },
          destination: { lat: dropOffLatitude, lng: dropOffLongitude },
          mode: TravelMode.driving,
          key: this.googleMaps.getApiKey(),
        },
      });

      const totalDistance =
        totalRouteResponse.data.routes[0]?.legs[0]?.distance?.value ?? 1;
      const distanceRemaining = leg.distance.value;
      const distanceTraveled = Math.max(0, totalDistance - distanceRemaining);
      const progressPercentage = Math.min(
        100,
        (distanceTraveled / totalDistance) * 100,
      );

      // 4. Generate Milestones
      const milestones = leg.steps.slice(0, 5).map((step: any) => {
        const stepDistance = step.distance.value;
        const stepDuration = step.duration.value;

        return {
          name: step.html_instructions.replace(/<[^>]*>?/gm, ''),
          distanceFromPickup: (distanceTraveled + stepDistance) / 1609.34,
          eta: new Date(Date.now() + stepDuration * 1000),
        };
      });

      // 5. Get driver current location's name
      let location: string | null = null;
      if (driver?.currentLatitude && driver?.currentLongitude) {
        const locationResponse = await this.googleMaps
          .getClient()
          .reverseGeocode({
            params: {
              latlng: `${driver.currentLatitude},${driver.currentLongitude}`,
              key: this.googleMaps.getApiKey(),
            },
          });
        location = locationResponse.data.results[0]?.formatted_address;
      }

      const result = {
        transportId: transport.id,

        animalId: transport.animalId,
        animalName: transport.animal.name,
        animalBreed: transport.animal.breed,

        bondedAnimalId: transport.bondedPairId ?? undefined,
        bondedAnimalName: transport.bondedPair?.name ?? undefined,
        bondedAnimalBreed: transport.bondedPair?.breed ?? undefined,

        status: transport.status,

        pickUpLocation: transport.pickUpLocation,
        pickUpLatitude: transport.pickUpLatitude,
        pickUpLongitude: transport.pickUpLongitude,

        dropOffLocation: transport.dropOffLocation,
        dropOffLatitude: transport.dropOffLatitude,
        dropOffLongitude: transport.dropOffLongitude,

        driverId: driver?.id ?? undefined,
        driverName: driver?.user?.name ?? undefined,

        currentLocation: location ?? undefined,
        currentLatitude: driver?.currentLatitude ?? undefined,
        currentLongitude: driver?.currentLongitude ?? undefined,

        driverConnected,
        lastLocationPing: driver?.lastLocationPing ?? undefined,

        totalDistance: totalDistance / 1609.34,
        distanceRemaining: distanceRemaining / 1609.34,
        progressPercentage,

        estimatedTotalTimeMinutes: leg.duration.value / 60,
        estimatedTimeRemainingMinutes: leg.duration.value / 60,
        estimatedDropOffTime: new Date(Date.now() + leg.duration.value * 1000),

        milestones,

        routePolyline: route.overview_polyline.points,
      };

      return successResponse(result, 'Live tracking data fetched');
    } catch (error: any) {
      this.logger.error('Failed to get live tracking data', error.stack);
      try {
        simplifyError(error, 'Failed to get tracking data', 'Transport');
      } catch (simplifiedError: any) {
        return errorResponse(null, simplifiedError.message);
      }
    }
  }
}
