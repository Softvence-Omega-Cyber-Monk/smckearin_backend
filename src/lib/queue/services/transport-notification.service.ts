import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '../enums/notification-types.enum';
import { QueueGateway } from '../queue.gateway';
import { BaseNotificationService } from './base-notification.service';

@Injectable()
export class TransportNotificationService extends BaseNotificationService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueGateway: QueueGateway,
  ) {
    super(prisma, queueGateway);
  }

  async notifyTransportEvent(
    eventType: 'CREATED' | 'DELETED' | 'DRIVER_DECISION' | 'DRIVER_ASSIGNED',
    transportId: string,
    additionalData?: any,
  ) {
    const transport = await this.prisma.client.transport.findUnique({
      where: { id: transportId },
      include: {
        animal: true,
        shelter: { include: { shelterAdmins: true, managers: true } },
        driver: { include: { user: true } },
        vet: { include: { user: true } },
      },
    });

    if (!transport) return;

    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [];
    const settings: string[] = ['tripNotifications', 'emailNotifications'];

    const shelterTeam = [
      ...(transport.shelter?.shelterAdmins.map((a) => a.id) || []),
      ...(transport.shelter?.managers.map((m) => m.id) || []),
    ];

    switch (eventType) {
      case 'CREATED':
        notifType = NotificationType.TRANSPORT_CREATED;
        title = 'New Transport Request Created';
        message = `A new transport request has been created for ${transport.animal.name}.`;
        recipients = [
          ...(transport.driver ? [transport.driver.userId] : []),
          ...(transport.vet ? [transport.vet.userId] : []),
          ...(await this.getAdmins()),
        ];
        break;

      case 'DELETED':
        notifType = NotificationType.TRANSPORT_DELETED;
        title = 'Transport Request Cancelled';
        message = `Transport request for ${transport.animal.name} has been cancelled.`;
        recipients = [
          ...(transport.driver ? [transport.driver.userId] : []),
          ...(transport.vet ? [transport.vet.userId] : []),
          ...shelterTeam,
        ];
        break;

      case 'DRIVER_DECISION':
        notifType = additionalData.accepted
          ? NotificationType.TRANSPORT_ACCEPTED
          : NotificationType.TRANSPORT_REJECTED;
        title = `Transport ${additionalData.accepted ? 'Accepted' : 'Rejected'}`;
        message = `Driver has ${additionalData.accepted ? 'accepted' : 'rejected'} the transport request for ${transport.animal.name}.`;
        recipients = [...shelterTeam, ...(await this.getAdmins())];
        break;

      case 'DRIVER_ASSIGNED':
        notifType = NotificationType.DRIVER_ASSIGNED;
        title = 'Driver Assigned to Transport';
        message = `You have been assigned to transport ${transport.animal.name}.`;
        const driver = await this.prisma.client.driver.findUnique({
          where: { id: additionalData.driverId },
          include: { user: true },
        });
        if (!driver) return;
        recipients = [driver.userId, ...shelterTeam];
        break;
    }

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy: 'SYSTEM',
        recordType: 'Transport',
        recordId: transportId,
        others: {
          animalName: transport.animal.name,
          shelterId: transport.shelterId,
          driverId: transport.driverId,
          vetId: transport.vetId,
        },
      },
      settings,
    );
  }
}
