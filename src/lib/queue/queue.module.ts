import { QueueName } from '@/common/enum/queue-name.enum';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { GenericEventsService } from './events/generic-events.service';
import { QueueGateway } from './queue.gateway';
import { BaseNotificationService } from './services/base-notification.service';
import { DocumentNotificationService } from './services/document-notification.service';
import { TransportNotificationService } from './services/transport-notification.service';
import { UserNotificationService } from './services/user-notification.service';
import { VetNotificationService } from './services/vet-notification.service';
import { GenericTriggerService } from './trigger/generic-trigger.service';
import { TransportTrackingService } from './trip/transport-tracking.service';
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
    TransportTrackingService,
    BaseNotificationService,
    UserNotificationService,
    DocumentNotificationService,
    TransportNotificationService,
    VetNotificationService,
  ],
  exports: [
    BullModule,
    UserNotificationService,
    DocumentNotificationService,
    TransportNotificationService,
    VetNotificationService,
  ],
})
export class QueueModule {}
