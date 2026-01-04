import { errorResponse } from '@/common/utils/response.util';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { RouteCalculationService } from './route-calculation.service';

export interface LiveTrackingData {
  transportId: string;
  animalId: string;
  animalName: string;
  animalBreed: string;
  bondedAnimalId?: string;
  bondedAnimalName?: string;
  bondedAnimalBreed?: string;
  status: string;
  pickUpLocation: string;
  pickUpLatitude: number;
  pickUpLongitude: number;
  dropOffLocation: string;
  dropOffLatitude: number;
  dropOffLongitude: number;
  driverId?: string;
  driverName: string;
  currentLocation: string;
  currentLatitude: number;
  currentLongitude: number;
  driverConnected: boolean;
  lastLocationPing?: Date;
  totalDistance: number; // miles
  distanceRemaining: number; // miles
  progressPercentage: number;
  estimatedTotalTimeMinutes: number;
  estimatedTimeRemainingMinutes: number;
  estimatedDropOffTime: Date | null;
  milestones: Array<{
    name: string;
    distanceFromPickup: number;
    eta: Date | null;
  }>;
  timeLine: any[];
  shelterId: string;
  shelterName?: string;
  routePolyline: string;
}

@Injectable()
export class TrackingDataService {
  private logger = new Logger(TrackingDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
    private readonly routeCalculation: RouteCalculationService,
  ) {}

  /**
   * Get enriched live tracking data for a transport
   */
  async getLiveTrackingData(
    transportId: string,
  ): Promise<LiveTrackingData | any> {
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

      // 2. Calculate route and get all route-related data
      const routeData = await this.routeCalculation.calculateRoute(
        currentLat,
        currentLng,
        pickUpLatitude,
        pickUpLongitude,
        dropOffLatitude,
        dropOffLongitude,
      );

      // 3. Get driver current location's name (reverse geocode)
      const location = await this.getCurrentLocationName(
        driver?.currentLatitude ?? undefined,
        driver?.currentLongitude ?? undefined,
      );

      // 4. Filter Timeline (Keep discrete status changes + first/last in-transit)
      const finalTimeline = this.filterTimeline(
        transport.transportTimelines ?? [],
      );

      const result: LiveTrackingData = {
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

        // convert meters -> miles for front-end
        totalDistance: routeData.totalDistance / 1609.34,
        distanceRemaining: routeData.distanceRemaining / 1609.34,
        progressPercentage: routeData.progressPercentage,

        estimatedTotalTimeMinutes: routeData.totalDistance / 1609.34 / 0.6, // placeholder
        estimatedTimeRemainingMinutes: routeData.estimatedTimeRemainingMinutes,
        estimatedDropOffTime: routeData.estimatedDropOffTime,

        milestones: routeData.milestones,

        timeLine: finalTimeline,

        shelterId: transport.shelterId ?? '',
        shelterName: transport?.shelter?.name ?? undefined,

        routePolyline: routeData.routePolyline,
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

  /**
   * Get current location name via reverse geocoding
   */
  private async getCurrentLocationName(
    latitude?: number,
    longitude?: number,
  ): Promise<string | null> {
    try {
      if (latitude && longitude) {
        const locationResponse = await this.googleMaps
          .getClient()
          .reverseGeocode({
            params: {
              latlng: `${latitude},${longitude}`,
              key: this.googleMaps.getApiKey(),
            },
          });
        return locationResponse.data.results?.[0]?.formatted_address ?? null;
      }
      return null;
    } catch (e) {
      this.logger.warn('Failed to reverse geocode location', e);
      return null;
    }
  }

  /**
   * Filter timeline to keep discrete status changes + first/last in-transit
   */
  private filterTimeline(rawTimeline: any[]): any[] {
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

    return [...otherEntries, ...filteredInTransit].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}
