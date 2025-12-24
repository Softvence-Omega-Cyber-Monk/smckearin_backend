import { Module } from '@nestjs/common';
import { TransportController } from './controllers/transport.controller';
import { CreateTransportService } from './services/create-transport.service';
import { GetDriverTransportService } from './services/get-driver-transport.service';
import { GetLiveTrackingService } from './services/get-live-tracking.service';
import { GetSingleTransportService } from './services/get-single-transport.service';
import { GetTransportService } from './services/get-transport.service';
import { ManageTransportService } from './services/manage-transport.service';

@Module({
  controllers: [TransportController],
  providers: [
    CreateTransportService,
    GetTransportService,
    GetSingleTransportService,
    GetDriverTransportService,
    ManageTransportService,
    GetLiveTrackingService,
  ],
})
export class TransportModule {}
