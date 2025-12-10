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
}
