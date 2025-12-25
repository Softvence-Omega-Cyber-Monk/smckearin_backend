import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleMapsService {
  private client: Client;
  private apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.getOrThrow<string>(
      ENVEnum.GOOGLE_MAPS_API_KEY,
    );
  }

  getClient(): Client {
    return this.client;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async validateCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: this.apiKey,
        },
      });

      return response.data.status === 'OK' && response.data.results.length > 0;
    } catch (error) {
      console.error('Google Maps validation error:', error);
      return false;
    }
  }

  async getDistanceAndDuration(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<{ distanceMiles: number; durationMinutes: number }> {
    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [origin],
          destinations: [destination],
          key: this.apiKey,
          units: 'imperial' as any, // For miles
        },
      });

      if (response.data.status !== 'OK' || !response.data.rows[0].elements[0]) {
        throw new Error('Google Maps Distance Matrix failed');
      }

      const element = response.data.rows[0].elements[0];

      if (element.status !== 'OK') {
        throw new Error(
          `Google Maps Distance Matrix element error: ${element.status}`,
        );
      }

      // Convert meters to miles (1 meter = 0.000621371 miles)
      const distanceMiles = element.distance.value * 0.000621371;

      // Convert seconds to minutes
      const durationMinutes = element.duration.value / 60;

      return {
        distanceMiles: parseFloat(distanceMiles.toFixed(2)),
        durationMinutes: Math.ceil(durationMinutes),
      };
    } catch (error) {
      console.error('Google Maps Distance/Duration error:', error);
      // Fallback to a very rough flat-earth calculation or zero if failed
      return { distanceMiles: 0, durationMinutes: 0 };
    }
  }
}
