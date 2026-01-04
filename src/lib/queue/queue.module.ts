import { QueueName } from '@/common/enum/queue-name.enum';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { WeatherService } from '../weather/weather.service';
import { GenericEventsService } from './events/generic-events.service';
import { QueueGateway } from './queue.gateway';
import { BaseNotificationService } from './services/base-notification.service';
import { DocumentNotificationService } from './services/document-notification.service';
import { TransportNotificationService } from './services/transport-notification.service';
import { UserNotificationService } from './services/user-notification.service';
import { VetNotificationService } from './services/vet-notification.service';
import { GenericTriggerService } from './trigger/generic-trigger.service';
import { LocationUpdateService } from './trip/location-update.service';
import { RouteCalculationService } from './trip/route-calculation.service';
import { TrackingDataService } from './trip/tracking-data.service';
import { TrackingHelperService } from './trip/tracking-helper.service';
import { GenericWorkerService } from './worker/generic-worker.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueName.NOTIFICATION },
      { name: QueueName.GENERIC },
    ),
  ],
  providers: [
    QueueGateway,
    GenericTriggerService,
    GenericEventsService,
    GenericWorkerService,
    // Transport tracking services
    TrackingHelperService,
    RouteCalculationService,
    TrackingDataService,
    LocationUpdateService,
    // Notification services
    BaseNotificationService,
    UserNotificationService,
    DocumentNotificationService,
    TransportNotificationService,
    VetNotificationService,
    WeatherService,
  ],
  exports: [
    BullModule,
    UserNotificationService,
    DocumentNotificationService,
    TransportNotificationService,
    VetNotificationService,
    RouteCalculationService,
    LocationUpdateService,
  ],
})
export class QueueModule {}
