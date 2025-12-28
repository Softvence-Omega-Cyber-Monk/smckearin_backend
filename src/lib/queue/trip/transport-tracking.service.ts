import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { errorResponse, successResponse } from '@/common/utils/response.util';
import { simplifyError } from '@/core/error/handle-error.simplify';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { TravelMode } from '@googlemaps/google-maps-services-js';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  DriverLocationUpdateDto,
  TransportLocationUpdateDto,
} from '../dto/transport-tracking.dto';
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

  private calculateAirDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  async updateLocation(client: Socket, payload: TransportLocationUpdateDto) {
    try {
      this.logger.log(`Updating location for transport ${payload.transportId}`);

      const userId = client.data.userId;
      this.logger.log(`User ID: ${userId}`);

      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return errorResponse(null, 'User not found');
      }

      const driver = await this.prisma.client.driver.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!driver) {
        return errorResponse(null, 'Driver not found');
      }

      const driverId = driver?.id;
      const { transportId, latitude, longitude } = payload;

      // check driver ownership
      const transport = await this.prisma.client.transport.findUnique({
        where: { id: transportId },
        select: { driverId: true },
      });

      if (!transport) {
        return errorResponse(null, 'Transport not found');
      }

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
      this.logger.error('Failed to update transport location', error);
      try {
        simplifyError(error, 'Failed to update location', 'Transport');
      } catch (simplifiedError: any) {
        return errorResponse(null, simplifiedError.message);
      }
    }
  }

  async updateDriverLocation(client: Socket, payload: DriverLocationUpdateDto) {
    try {
      const userId = client.data.userId;
      if (!userId) return errorResponse(null, 'Unauthorized');

      const driver = await this.prisma.client.driver.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!driver) return errorResponse(null, 'Driver not found');

      const { latitude, longitude, heading, speed } = payload;

      // 1. Update Driver's current location and last ping
      await this.prisma.client.driver.update({
        where: { id: driver.id },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationPing: new Date(),
        },
      });

      // 2. Find all active transports for this driver
      const activeTransports = await this.prisma.client.transport.findMany({
        where: {
          driverId: driver.id,
          status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
        select: { id: true },
      });

      if (activeTransports.length === 0) {
        return successResponse(
          null,
          'Driver location updated, no active transports',
        );
      }

      // 3. Update each active transport
      for (const transport of activeTransports) {
        try {
          // Save to TransportTimeline for each transport
          await this.prisma.client.transportTimeline.create({
            data: {
              transportId: transport.id,
              status: 'IN_TRANSIT',
              latitude,
              longitude,
              note: `Driver live location (Heading: ${heading ?? 'N/A'}, Speed: ${speed ?? 'N/A'})`,
            },
          });

          // Get Enriched Tracking Data
          const liveData = await this.getLiveTrackingData(transport.id);

          // Emit to all connected clients tracking this transport
          this.gateway.emitToRoom(
            `transport-${transport.id}`,
            QueueEventsEnum.TRANSPORT_TRACKING_DATA,
            successResponse(liveData, 'Location updated'),
          );
        } catch (e) {
          this.logger.error(`Failed to update transport ${transport.id}`, e);
        }
      }

      return successResponse(
        null,
        'Driver location updated and broadcasts sent',
      );
    } catch (error: any) {
      this.logger.error('Failed to update driver location', error);
      return errorResponse(null, 'Failed to update driver location');
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
          transportTimelines: true,
          shelter: true,
        },
      });

      if (!transport) {
        throw new Error('Transport not found');
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

      // Initialize route-dependent variables with safe defaults
      let routePolyline = '';
      let totalDistance = 0;
      let distanceRemaining = 0;
      let progressPercentage = 0;
      let estimatedDropOffTime = null;
      let milestones: any[] = [];
      let estimatedTimeRemainingMinutes = 0;

      try {
        // 2. Fetch Directions from Google Maps (Current to Drop-off)
        const directionsResponse = await this.googleMaps
          .getClient()
          .directions({
            params: {
              origin: { lat: currentLat, lng: currentLng },
              destination: { lat: dropOffLatitude, lng: dropOffLongitude },
              mode: TravelMode.driving,
              key: this.googleMaps.getApiKey(),
            },
          });

        if (
          directionsResponse.data.status === 'OK' &&
          directionsResponse.data.routes[0]
        ) {
          const route = directionsResponse.data.routes[0];
          const leg = route.legs[0];
          routePolyline = route.overview_polyline.points;
          distanceRemaining = leg.distance.value;
          estimatedTimeRemainingMinutes = leg.duration.value / 60;
          estimatedDropOffTime = new Date(
            Date.now() + leg.duration.value * 1000,
          );

          // Calculate Total Distance (Pickup to Drop-off)
          const totalRouteResponse = await this.googleMaps
            .getClient()
            .directions({
              params: {
                origin: { lat: pickUpLatitude, lng: pickUpLongitude },
                destination: { lat: dropOffLatitude, lng: dropOffLongitude },
                mode: TravelMode.driving,
                key: this.googleMaps.getApiKey(),
              },
            });

          totalDistance =
            totalRouteResponse.data.routes[0]?.legs[0]?.distance?.value ??
            distanceRemaining;

          // Milestones
          milestones = leg.steps.slice(0, 5).map((step: any) => ({
            name: step.html_instructions.replace(/<[^>]*>?/gm, ''),
            distanceFromPickup: 0, // Simplified for brevity in error cases
            eta: new Date(Date.now() + step.duration.value * 1000),
          }));
        } else {
          this.logger.warn(
            `Driving route failed (${directionsResponse.data.status}). Falling back to air distance.`,
          );
          // Fallback to Air Distance
          distanceRemaining = this.calculateAirDistance(
            currentLat,
            currentLng,
            dropOffLatitude,
            dropOffLongitude,
          );
          totalDistance = this.calculateAirDistance(
            pickUpLatitude,
            pickUpLongitude,
            dropOffLatitude,
            dropOffLongitude,
          );
          // 40 mph average speed estimate for ETA
          estimatedTimeRemainingMinutes =
            (distanceRemaining / 1609.34 / 40) * 60;
          estimatedDropOffTime = new Date(
            Date.now() + estimatedTimeRemainingMinutes * 60000,
          );
        }

        // Calculate Progress
        if (totalDistance > 0) {
          const distanceTraveled = Math.max(
            0,
            totalDistance - distanceRemaining,
          );
          progressPercentage = Math.min(
            100,
            (distanceTraveled / totalDistance) * 100,
          );
        }
      } catch (err) {
        this.logger.warn('Error during route calculation, using defaults', err);
        // Ensure some basic distance if everything fails
        if (totalDistance === 0) totalDistance = 1;
      }

      // 5. Get driver current location's name
      let location: string | null = null;
      try {
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
      } catch (e) {
        this.logger.warn('Failed to reverse geocode location', e);
      }

      // 6. Filter Timeline (Keep discrete status changes + first/last in-transit)
      const rawTimeline = transport.transportTimelines || [];
      const inTransitEntries = rawTimeline.filter(
        (e) => e.status === 'IN_TRANSIT',
      );
      const otherEntries = rawTimeline.filter((e) => e.status !== 'IN_TRANSIT');

      const filteredInTransit = [];
      if (inTransitEntries.length > 0) {
        filteredInTransit.push(inTransitEntries[0]);
        if (inTransitEntries.length > 1) {
          filteredInTransit.push(inTransitEntries[inTransitEntries.length - 1]);
        }
      }

      const finalTimeline = [...otherEntries, ...filteredInTransit].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

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
        driverName: driver?.user?.name ?? 'Assigned Driver',

        currentLocation: location ?? 'Pending Update',
        currentLatitude: currentLat,
        currentLongitude: currentLng,

        driverConnected,
        lastLocationPing: driver?.lastLocationPing ?? undefined,

        totalDistance: totalDistance / 1609.34,
        distanceRemaining: distanceRemaining / 1609.34,
        progressPercentage,

        estimatedTotalTimeMinutes: totalDistance / 1609.34 / 0.6, // placeholder
        estimatedTimeRemainingMinutes,
        estimatedDropOffTime,

        milestones,

        timeLine: finalTimeline,

        shelterId: transport.shelterId,
        shelterName: transport?.shelter?.name ?? undefined,

        routePolyline,
      };

      return result;
    } catch (error: any) {
      this.logger.error(
        'Failed to get live tracking data (unhandled)',
        error.stack || error,
      );
      return errorResponse(null, error.message || 'Tracking system error');
    }
  }
}
