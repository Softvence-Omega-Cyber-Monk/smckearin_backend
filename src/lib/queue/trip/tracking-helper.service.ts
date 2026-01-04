import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TrackingHelperService {
  private logger = new Logger(TrackingHelperService.name);

  /**
   * Calculate the air distance between two coordinates using the Haversine formula
   * @returns Distance in meters
   */
  calculateAirDistance(
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

  /**
   * Create a simple straight line polyline with intermediate points
   */
  createSimplePolyline(
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

  /**
   * Encode coordinates into a polyline string
   */
  encodePolyline(points: { lat: number; lng: number }[]): string {
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

  /**
   * Encode a number for polyline format
   */
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
}
