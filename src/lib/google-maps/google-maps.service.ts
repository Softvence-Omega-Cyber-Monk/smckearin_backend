import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

  async computeRoutes(params: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    travelMode?: 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER' | string;
    computeAlternativeRoutes?: boolean;
  }) {
    const body = {
      origin: {
        location: {
          latLng: {
            latitude: params.origin.lat,
            longitude: params.origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: params.destination.lat,
            longitude: params.destination.lng,
          },
        },
      },
      travelMode: params.travelMode ?? 'DRIVE',
      computeAlternativeRoutes: params.computeAlternativeRoutes ?? false,
      // you can add routeModifiers, routingPreference, etc. if needed
    };

    try {
      const resp = await axios.post(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.legs.steps',
          },
          timeout: 10000,
        },
      );
      return resp;
    } catch (error) {
      // Re-throw so caller can catch and fallback
      throw error;
    }
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
