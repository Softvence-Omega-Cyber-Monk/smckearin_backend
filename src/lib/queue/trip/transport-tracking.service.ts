import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { errorResponse, successResponse } from '@/common/utils/response.util';
import { simplifyError } from '@/core/error/handle-error.simplify';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
// import { TravelMode } from '@googlemaps/google-maps-services-js';
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

  private createSimplePolyline(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): string {
    // Create a simple straight line polyline with a few intermediate points
    const points = [];
    const steps = 10; // Number of intermediate points

    for (let i = 0; i <= steps; i++) {
      const lat = startLat + (endLat - startLat) * (i / steps);
      const lng = startLng + (endLng - startLng) * (i / steps);
      points.push({ lat, lng });
    }

    // Encode the points using Google's polyline algorithm
    return this.encodePolyline(points);
  }

  private encodePolyline(points: { lat: number; lng: number }[]): string {
    // Simple polyline encoding implementation
    let encoded = '';

    for (const point of points) {
      // Convert to integer coordinates
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);

      // Encode latitude
      encoded += this.encodeNumber(lat);
      // Encode longitude
      encoded += this.encodeNumber(lng);
    }

    return encoded;
  }

  private encodeNumber(num: number): string {
    // Simple polyline number encoding
    let encoded = '';
    let value = num < 0 ? ~(num << 1) : num << 1;

    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }

    encoded += String.fromCharCode(value + 63);
    return encoded;
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

  // assume this method sits in your service where this.googleMaps is GoogleMapsService
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
      let totalDistance = 0; // meters
      let distanceRemaining = 0; // meters
      let progressPercentage = 0;
      let estimatedDropOffTime: Date | null = null;
      let milestones: any[] = [];
      let estimatedTimeRemainingMinutes = 0;

      try {
        // 2. Compute route from current location to drop-off using Routes API helper
        this.logger.log(
          `Calculating route (Routes API) from current location (${currentLat}, ${currentLng}) to drop-off (${dropOffLatitude}, ${dropOffLongitude})`,
        );

        const routeResp = await this.googleMaps.computeRoutes({
          origin: { lat: currentLat, lng: currentLng },
          destination: { lat: dropOffLatitude, lng: dropOffLongitude },
          travelMode: 'DRIVE',
          computeAlternativeRoutes: false,
        });

        // routeResp is an axios response. Parse defensively to support older/newer shapes.
        const routeData = routeResp?.data ?? {};
        this.logger.log(`Routes API response status: ${routeResp?.status}, data keys: ${Object.keys(routeData || {})}`);
        
        let route: any = routeData.routes?.[0] ?? null;

        // Fallback: sometimes libs return directions-style shape
        if (
          !route &&
          routeData.status === 'OK' &&
          routeData.routes?.length > 0
        ) {
          route = routeData.routes[0];
        }

        if (route) {
          // legs array may be present (Routes API uses route.legs)
          const leg = route.legs?.[0] ?? null;
          this.logger.log(`Route calculated successfully: ${JSON.stringify(route, null, 2)}`);

          // Polyline: Routes API uses route.polyline.encodedPolyline (or route.overview_polyline for old)
          routePolyline =
            route.polyline?.encodedPolyline ??
            route.overview_polyline?.points ??
            '';

          // Distance: Routes API uses leg.distanceMeters, old uses leg.distance.value
          distanceRemaining =
            (leg?.distanceMeters as number) ??
            (leg?.distance?.value as number) ??
            0;

          // Duration: Routes API uses leg.duration?.seconds, old uses leg.duration.value
          const durationSeconds =
            (leg?.duration?.seconds as number) ??
            (leg?.duration?.value as number) ??
            0;

          estimatedTimeRemainingMinutes = durationSeconds / 60;
          estimatedDropOffTime = durationSeconds
            ? new Date(Date.now() + durationSeconds * 1000)
            : null;

          this.logger.log(
            `Route calculated successfully: ${distanceRemaining}m remaining, polyline length: ${routePolyline.length}`,
          );

          // Calculate Total Distance (Pickup to Drop-off) via another computeRoutes call
          try {
            const totalRouteResp = await this.googleMaps.computeRoutes({
              origin: { lat: pickUpLatitude, lng: pickUpLongitude },
              destination: { lat: dropOffLatitude, lng: dropOffLongitude },
              travelMode: 'DRIVE',
              computeAlternativeRoutes: false,
            });

            const totalData = totalRouteResp?.data ?? {};
            const totalRoute = totalData.routes?.[0] ?? null;

            if (totalRoute) {
              const totalLeg = totalRoute.legs?.[0] ?? null;
              totalDistance =
                (totalLeg?.distanceMeters as number) ??
                (totalLeg?.distance?.value as number) ??
                distanceRemaining;
              this.logger.log(
                `Total route distance calculated: ${totalDistance}m`,
              );
            } else {
              this.logger.warn(
                `Total route calculation returned no route, using remaining distance as fallback`,
              );
              totalDistance = distanceRemaining;
            }
          } catch (totalRouteError) {
            this.logger.error(
              'Failed to calculate total route distance',
              totalRouteError,
            );
            totalDistance = distanceRemaining;
          }

          // Milestones - prefer steps from leg; Routes API step structure
          const steps = leg?.steps ?? route.legs?.[0]?.steps ?? [];
          if (steps && steps.length > 0) {
            // Keep max 5 approximate milestones
            const maxMilestones = Math.min(10, steps.length);
            let accumulatedDistance = 0;
            
            milestones = steps
              .slice(0, maxMilestones)
              .map((step: any, index: number) => {
                // Routes API uses navigationInstruction.instructions
                const htmlInstr = 
                  step.navigationInstruction?.instructions ??
                  step.htmlInstructions ??
                  step.html_instructions ??
                  `Step ${index + 1}`;
                  
                const cleaned = htmlInstr.replace(/<[^>]*>?/gm, '');
                
                // Routes API step duration is in staticDuration (string like "32s") or duration.seconds
                let stepDurationSeconds = 0;
                if (step.staticDuration) {
                  // Parse duration string like "32s" or "1h 32m"
                  const durationStr = step.staticDuration;
                  const hourMatch = durationStr.match(/(\d+)h/);
                  const minMatch = durationStr.match(/(\d+)m/);
                  const secMatch = durationStr.match(/(\d+)s/);
                  
                  stepDurationSeconds = 
                    (hourMatch ? parseInt(hourMatch[1]) * 3600 : 0) +
                    (minMatch ? parseInt(minMatch[1]) * 60 : 0) +
                    (secMatch ? parseInt(secMatch[1]) : 0);
                } else {
                  stepDurationSeconds =
                    (step?.duration?.seconds as number) ??
                    (step?.duration?.value as number) ??
                    0;
                }
                
                // Routes API step distance is in distanceMeters
                const stepDistanceMeters =
                  (step.distanceMeters as number) ??
                  (step?.distance?.value as number) ??
                  0;
                
                // Calculate cumulative distance from pickup
                accumulatedDistance += stepDistanceMeters;
                const distanceFromPickup = accumulatedDistance;
                
                return {
                  name: cleaned,
                  distanceFromPickup,
                  eta: stepDurationSeconds
                    ? new Date(Date.now() + stepDurationSeconds * 1000)
                    : null,
                };
              });
          } else {
            // If no steps available, create simple milestones based on distance
            const milestoneCount = Math.min(5, Math.ceil(totalDistance / 10000)); // One milestone per ~10km
            milestones = Array.from({ length: milestoneCount }, (_, index) => ({
              name: `Milestone ${index + 1}`,
              distanceFromPickup: ((index + 1) * totalDistance) / milestoneCount,
              eta: new Date(Date.now() + ((index + 1) * estimatedTimeRemainingMinutes * 60000) / milestoneCount),
            }));
          }
        } else {
          // No route returned from computeRoutes
          this.logger.warn(
            `Routes API returned no route object. Falling back to air distance.`,
          );
          this.logger.log(`Full Routes API response: ${JSON.stringify(routeData, null, 2)}`);
          this.logger.log(`Available routes: ${routeData.routes?.length || 0}`);
          if (routeData.routes && routeData.routes.length > 0) {
            this.logger.log(`First route structure: ${JSON.stringify(routeData.routes[0], null, 2)}`);
          }
        }
      } catch (err) {
        // If anything fails, fallback to air distance and simple polyline, as before
        this.logger.warn(
          'Route calculation failed, using air distance fallback',
          err,
        );

        // Fallback to Air Distance (meters)
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
        estimatedTimeRemainingMinutes = (distanceRemaining / 1609.34 / 40) * 60;
        estimatedDropOffTime = new Date(
          Date.now() + estimatedTimeRemainingMinutes * 60000,
        );

        // Create a simple straight-line polyline for fallback
        routePolyline = this.createSimplePolyline(
          currentLat,
          currentLng,
          dropOffLatitude,
          dropOffLongitude,
        );

        this.logger.log(
          `Fallback values calculated: totalDistance=${totalDistance}m, distanceRemaining=${distanceRemaining}m, polyline created`,
        );

        // Generate fallback milestones when using air distance
        const milestoneCount = Math.min(5, Math.ceil(totalDistance / 10000)); // One milestone per ~10km
        milestones = Array.from({ length: milestoneCount }, (_, index) => ({
          name: `Milestone ${index + 1}`,
          distanceFromPickup: ((index + 1) * totalDistance) / milestoneCount,
          eta: new Date(Date.now() + ((index + 1) * estimatedTimeRemainingMinutes * 60000) / milestoneCount),
        }));
      }

      // Calculate Progress (outside try-catch to ensure it always runs)
      if (totalDistance > 0) {
        const distanceTraveled = Math.max(0, totalDistance - distanceRemaining);
        progressPercentage = Math.min(
          100,
          (distanceTraveled / totalDistance) * 100,
        );
        this.logger.log(
          `Progress calculated: ${progressPercentage.toFixed(2)}% (${distanceTraveled}m traveled of ${totalDistance}m total)`,
        );
      } else {
        this.logger.warn('Total distance is 0, cannot calculate progress');
        totalDistance = Math.max(1, distanceRemaining); // Ensure we have some distance
      }

      // 5. Get driver current location's name (reverse geocode)
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
          location =
            locationResponse.data.results?.[0]?.formatted_address ?? null;
        }
      } catch (e) {
        this.logger.warn('Failed to reverse geocode location', e);
      }

      // 6. Filter Timeline (Keep discrete status changes + first/last in-transit)
      const rawTimeline = transport.transportTimelines ?? [];
      const inTransitEntries = rawTimeline.filter(
        (e) => e.status === 'IN_TRANSIT',
      );
      const otherEntries = rawTimeline.filter((e) => e.status !== 'IN_TRANSIT');

      const filteredInTransit: any[] = [];
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
        animalName: transport.animal?.name,
        animalBreed: transport.animal?.breed,

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

        // convert meters -> miles for front-end as before
        totalDistance: totalDistance / 1609.34,
        distanceRemaining: distanceRemaining / 1609.34,
        progressPercentage,

        estimatedTotalTimeMinutes: totalDistance / 1609.34 / 0.6, // placeholder (kept as before)
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
