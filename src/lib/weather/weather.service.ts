import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WeatherInfo {
  temperature: number;
  condition: string;
  code: number;
  isDay: boolean;
  windSpeed: number;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly API_URL = 'https://api.open-meteo.com/v1/forecast';

  /**
   * Get current weather for a specific location
   */
  async getCurrentWeather(
    latitude: number,
    longitude: number,
  ): Promise<WeatherInfo | null> {
    try {
      const response = await axios.get(this.API_URL, {
        params: {
          latitude,
          longitude,
          current_weather: true,
          temperature_unit: 'fahrenheit', // US standard requested often, or configurable
          windspeed_unit: 'mph',
        },
        timeout: 5000,
      });

      const data = response.data?.current_weather;
      if (!data) return null;

      return {
        temperature: data.temperature,
        condition: this.getWeatherDescription(data.weathercode),
        code: data.weathercode,
        isDay: data.is_day === 1,
        windSpeed: data.windspeed,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch weather for ${latitude},${longitude}`,
        error,
      );
      return null;
    }
  }

  /**
   * Convert WMO weather code to human readable description
   * Source: https://open-meteo.com/en/docs
   */
  private getWeatherDescription(code: number): string {
    const codes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };

    return codes[code] || 'Unknown';
  }
}
