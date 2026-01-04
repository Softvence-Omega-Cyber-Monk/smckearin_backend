import { Global, Module } from '@nestjs/common';
import { WeatherService } from './weather.service';

@Global()
@Module({
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
