import { Module } from '@nestjs/common';
import { TransportController } from './controllers/transport.controller';
import { CreateTransportService } from './services/create-transport.service';
import { GetSingleTransportService } from './services/get-single-transport.service';
import { GetTransportService } from './services/get-transport.service';

@Module({
  controllers: [TransportController],
  providers: [
    CreateTransportService,
    GetTransportService,
    GetSingleTransportService,
  ],
})
export class TransportModule {}
