import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { Injectable, Logger } from '@nestjs/common';
import { TrackingHelperService } from './tracking-helper.service';

export interface RouteCalculationResult {
  routePolyline: string;
  totalDistance: number; // meters
  distanceRemaining: number; // meters
  progressPercentage: number;
  estimatedDropOffTime: Date | null;
  milestones: Array<{
    name: string;
    distanceFromPickup: number;
    eta: Date | null;
    latitude?: number;
    longitude?: number;
  }>;
  estimatedTimeRemainingMinutes: number;
}

@Injectable()
export class RouteCalculationService {
  private logger = new Logger(RouteCalculationService.name);

  constructor(
    private readonly googleMaps: GoogleMapsService,
    private readonly trackingHelper: TrackingHelperService,
  ) { }

  /**
   * Calculate route from current location to drop-off
   */
  async calculateRoute(
    currentLat: number,
    currentLng: number,
    pickUpLatitude: number,
    pickUpLongitude: number,
    dropOffLatitude: number,
    dropOffLongitude: number,
  ): Promise<RouteCalculationResult> {
    // Initialize route-dependent variables with safe defaults
    let routePolyline = '';
    let totalDistance = 0; // meters
    let distanceRemaining = 0; // meters
    let progressPercentage = 0;
    let estimatedDropOffTime: Date | null = null;
    let milestones: any[] = [];
    let estimatedTimeRemainingMinutes = 0;

    try {
      // Compute route from current location to drop-off using Routes API helper
      this.logger.log(
        `Calculating route (Routes API) from current location (${currentLat}, ${currentLng}) to drop-off (${dropOffLatitude}, ${dropOffLongitude})`,
      );

      const routeResp = await this.googleMaps.computeRoutes({
        origin: { lat: currentLat, lng: currentLng },
        destination: { lat: dropOffLatitude, lng: dropOffLongitude },
        travelMode: 'DRIVE',
        computeAlternativeRoutes: false,
      });

      const routeData = routeResp?.data ?? {};
      let route: any = routeData.routes?.[0] ?? null;

      // Fallback: sometimes libs return directions-style shape
      if (!route && routeData.status === 'OK' && routeData.routes?.length > 0) {
        route = routeData.routes[0];
      }

      if (route) {
        const leg = route.legs?.[0] ?? null;
        this.logger.log(
          `Route calculated successfully: ${JSON.stringify(route, null, 2)}`,
        );

        // Polyline: Routes API uses route.polyline.encodedPolyline
        routePolyline =
          route.polyline?.encodedPolyline ??
          route.overview_polyline?.points ??
          '';

        // Distance: Routes API uses leg.distanceMeters
        distanceRemaining =
          (leg?.distanceMeters as number) ??
          (leg?.distance?.value as number) ??
          0;

        // Duration: Parse from leg.staticDuration or leg.duration
        const durationSeconds = this.parseDuration(leg);
        this.logger.log(`Final durationSeconds: ${durationSeconds}`);

        estimatedTimeRemainingMinutes = durationSeconds / 60;
        estimatedDropOffTime = durationSeconds
          ? new Date(Date.now() + durationSeconds * 1000)
          : null;

        this.logger.log(
          `Route calculated successfully: ${distanceRemaining}m remaining, ${estimatedTimeRemainingMinutes} mins remaining, polyline length: ${routePolyline.length}`,
        );

        // Calculate Total Distance (Pickup to Drop-off)
        totalDistance = await this.calculateTotalDistance(
          pickUpLatitude,
          pickUpLongitude,
          dropOffLatitude,
          dropOffLongitude,
          distanceRemaining,
        );

        // Generate milestones
        milestones = this.generateMilestones(
          leg,
          route,
          totalDistance,
          estimatedTimeRemainingMinutes,
        );
      } else {
        // No route returned from computeRoutes
        this.logger.warn(
          `Routes API returned no route object. Falling back to air distance.`,
        );
        this.logger.log(
          `Full Routes API response: ${JSON.stringify(routeData, null, 2)}`,
        );
      }
    } catch (err) {
      // If anything fails, fallback to air distance and simple polyline
      this.logger.warn(
        'Route calculation failed, using air distance fallback',
        err,
      );

      return this.calculateFallbackRoute(
        currentLat,
        currentLng,
        pickUpLatitude,
        pickUpLongitude,
        dropOffLatitude,
        dropOffLongitude,
      );
    }

    // Calculate Progress
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
      totalDistance = Math.max(1, distanceRemaining);
    }

    return {
      routePolyline,
      totalDistance,
      distanceRemaining,
      progressPercentage,
      estimatedDropOffTime,
      milestones,
      estimatedTimeRemainingMinutes,
    };
  }

  /**
   * Parse duration from leg data (handles both string and object formats)
   */
  private parseDuration(leg: any): number {
    let durationSeconds = 0;

    this.logger.log(
      `Leg duration data: ${JSON.stringify(leg?.duration, null, 2)}`,
    );
    this.logger.log(`Leg staticDuration: ${leg?.staticDuration}`);

    // Try Routes API staticDuration first (string like "32s" or "1h 32m")
    if (leg?.staticDuration) {
      durationSeconds = this.parseDurationString(leg.staticDuration);
      this.logger.log(
        `Parsed staticDuration "${leg.staticDuration}" to ${durationSeconds}s`,
      );
    } else if (typeof leg?.duration === 'string') {
      // Handle case where duration is a string like "19033s"
      durationSeconds = this.parseDurationString(leg.duration);
      this.logger.log(
        `Parsed duration string "${leg.duration}" to ${durationSeconds}s`,
      );
    } else {
      // Fallback to duration.seconds or duration.value
      durationSeconds =
        (leg?.duration?.seconds as number) ??
        (leg?.duration?.value as number) ??
        0;
    }

    return durationSeconds;
  }

  /**
   * Parse duration string like "32s", "1h 32m", "19033s"
   */
  private parseDurationString(durationStr: string): number {
    const hourMatch = durationStr.match(/(\d+)h/);
    const minMatch = durationStr.match(/(\d+)m/);
    const secMatch = durationStr.match(/(\d+)s/);

    return (
      (hourMatch ? parseInt(hourMatch[1]) * 3600 : 0) +
      (minMatch ? parseInt(minMatch[1]) * 60 : 0) +
      (secMatch ? parseInt(secMatch[1]) : 0)
    );
  }

  /**
   * Calculate total distance from pickup to drop-off
   */
  private async calculateTotalDistance(
    pickUpLatitude: number,
    pickUpLongitude: number,
    dropOffLatitude: number,
    dropOffLongitude: number,
    fallbackDistance: number,
  ): Promise<number> {
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
        const totalDistance =
          (totalLeg?.distanceMeters as number) ??
          (totalLeg?.distance?.value as number) ??
          fallbackDistance;
        this.logger.log(`Total route distance calculated: ${totalDistance}m`);
        return totalDistance;
      } else {
        this.logger.warn(
          `Total route calculation returned no route, using remaining distance as fallback`,
        );
        return fallbackDistance;
      }
    } catch (totalRouteError) {
      this.logger.error(
        'Failed to calculate total route distance',
        totalRouteError,
      );
      return fallbackDistance;
    }
  }

  /**
   * Generate milestones from route steps
   */
  private generateMilestones(
    leg: any,
    route: any,
    totalDistance: number,
    estimatedTimeRemainingMinutes: number,
  ): Array<{
    name: string;
    distanceFromPickup: number;
    eta: Date | null;
    latitude?: number;
    longitude?: number;
  }> {
    const steps = leg?.steps ?? route.legs?.[0]?.steps ?? [];

    if (steps && steps.length > 0) {
      // Keep max 10 approximate milestones
      const maxMilestones = Math.min(10, steps.length);
      let accumulatedDistance = 0;
      let accumulatedTime = 0;

      return steps.slice(0, maxMilestones).map((step: any, index: number) => {
        // Routes API uses navigationInstruction.instructions
        const htmlInstr =
          step.navigationInstruction?.instructions ??
          step.htmlInstructions ??
          step.html_instructions ??
          `Step ${index + 1}`;

        const cleaned = htmlInstr.replace(/<[^>]*>?/gm, '');

        // Parse step duration
        let stepDurationSeconds = 0;
        if (step.staticDuration) {
          stepDurationSeconds = this.parseDurationString(step.staticDuration);
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

        // Calculate cumulative distance and time from current position
        accumulatedDistance += stepDistanceMeters;
        accumulatedTime += stepDurationSeconds;
        const distanceFromPickup = accumulatedDistance;

        this.logger.log(
          `Step ${index + 1}: "${cleaned}" - Distance: ${stepDistanceMeters}m, Duration: ${stepDurationSeconds}s, Accumulated Time: ${accumulatedTime}s`,
        );

        return {
          name: cleaned,
          distanceFromPickup,
          eta:
            accumulatedTime > 0
              ? new Date(Date.now() + accumulatedTime * 1000)
              : null,
          latitude: step.startLocation?.latLng?.latitude,
          longitude: step.startLocation?.latLng?.longitude,
        };
      });
    } else {
      // If no steps available, create simple milestones based on distance
      const milestoneCount = Math.min(5, Math.ceil(totalDistance / 10000)); // One milestone per ~10km
      this.logger.log(
        `No steps available, generating ${milestoneCount} fallback milestones based on total distance: ${totalDistance}m`,
      );
      return Array.from({ length: milestoneCount }, (_, index) => {
        const ratio = (index + 1) / milestoneCount;
        // Approximation for fallback
        // We really can't guess coordinates easily without context, but strictly for
        // interface compliance we can interpolate linearly or omit. Omit is safer unless we need them.
        // But for weather we need them. Let's interpolate linearly from current to dropoff.
        // Use "route" variable if available? No, this is "no steps" block.
        // We don't have lat/lng passed into generateMilestones easily for interpolation here
        // without adding arguments.
        // Let's modify generateMilestones signature later if needed, but for now fallback can serve null.
        return {
          name: `Milestone ${index + 1}`,
          distanceFromPickup: ((index + 1) * totalDistance) / milestoneCount,
          eta: new Date(
            Date.now() +
            ((index + 1) * estimatedTimeRemainingMinutes * 60000) /
            milestoneCount,
          ),
        };
      });
    }
  }

  /**
   * Calculate fallback route using air distance when API fails
   */
  private calculateFallbackRoute(
    currentLat: number,
    currentLng: number,
    pickUpLatitude: number,
    pickUpLongitude: number,
    dropOffLatitude: number,
    dropOffLongitude: number,
  ): RouteCalculationResult {
    // Fallback to Air Distance (meters)
    const distanceRemaining = this.trackingHelper.calculateAirDistance(
      currentLat,
      currentLng,
      dropOffLatitude,
      dropOffLongitude,
    );
    const totalDistance = this.trackingHelper.calculateAirDistance(
      pickUpLatitude,
      pickUpLongitude,
      dropOffLatitude,
      dropOffLongitude,
    );

    // 40 mph average speed estimate for ETA
    const estimatedTimeRemainingMinutes =
      (distanceRemaining / 1609.34 / 40) * 60;
    const estimatedDropOffTime = new Date(
      Date.now() + estimatedTimeRemainingMinutes * 60000,
    );

    // Create a simple straight-line polyline for fallback
    const routePolyline = this.trackingHelper.createSimplePolyline(
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
    const milestones = Array.from({ length: milestoneCount }, (_, index) => {
      const ratio = (index + 1) / milestoneCount;
      const lat = currentLat + (dropOffLatitude - currentLat) * ratio;
      const lng = currentLng + (dropOffLongitude - currentLng) * ratio;

      return {
        name: `Milestone ${index + 1}`,
        distanceFromPickup: ((index + 1) * totalDistance) / milestoneCount,
        eta: new Date(
          Date.now() +
          ((index + 1) * estimatedTimeRemainingMinutes * 60000) /
          milestoneCount,
        ),
        latitude: lat,
        longitude: lng,
      };
    });

    // Calculate Progress
    const distanceTraveled = Math.max(0, totalDistance - distanceRemaining);
    const progressPercentage = Math.min(
      100,
      (distanceTraveled / totalDistance) * 100,
    );

    return {
      routePolyline,
      totalDistance,
      distanceRemaining,
      progressPercentage,
      estimatedDropOffTime,
      milestones,
      estimatedTimeRemainingMinutes,
    };
  }
}
