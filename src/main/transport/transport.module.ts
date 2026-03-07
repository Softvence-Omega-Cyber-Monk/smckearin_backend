import { QueueGateway } from '@/lib/queue/queue.gateway';
import { TrackingDataService } from '@/lib/queue/trip/tracking-data.service';
import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { TransportChatController } from './controllers/transport-chat.controller';
import { TransportController } from './controllers/transport.controller';
import { CreateTransportService } from './services/create-transport.service';
import { GetDriverTransportService } from './services/get-driver-transport.service';
import { GetLiveTrackingService } from './services/get-live-tracking.service';
import { GetSingleTransportService } from './services/get-single-transport.service';
import { GetTransportService } from './services/get-transport.service';
import { ManageTransportService } from './services/manage-transport.service';
import { TransportChatService } from './services/transport-chat.service';

@Module({
  imports: [PaymentModule],
  controllers: [TransportController, TransportChatController],
  providers: [
    CreateTransportService,
    GetTransportService,
    GetSingleTransportService,
    GetDriverTransportService,
    ManageTransportService,
    GetLiveTrackingService,
    TransportChatService,
    TrackingDataService,
    QueueGateway,
  ],
})
export class TransportModule {}
