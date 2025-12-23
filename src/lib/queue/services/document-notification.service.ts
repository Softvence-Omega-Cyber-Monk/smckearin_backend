import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '../enums/notification-types.enum';
import { QueueGateway } from '../queue.gateway';
import { BaseNotificationService } from './base-notification.service';

@Injectable()
export class DocumentNotificationService extends BaseNotificationService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueGateway: QueueGateway,
  ) {
    super(prisma, queueGateway);
  }

  async notifyDocumentEvent(
    eventType:
      | 'SHELTER_DOCUMENT_UPLOADED'
      | 'SHELTER_DOCUMENT_APPROVED'
      | 'DRIVER_DOCUMENT_UPLOADED'
      | 'DRIVER_DOCUMENT_APPROVED'
      | 'VET_DOCUMENT_UPLOADED'
      | 'VET_DOCUMENT_APPROVED',
    entityId: string,
    additionalData: any,
  ) {
    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [];
    const settings: string[] = [
      'emailNotifications',
      'certificateNotifications',
    ];

    if (eventType.includes('SHELTER')) {
      const doc = await this.prisma.client.shelterDocument.findUnique({
        where: { id: entityId },
        include: {
          shelter: { include: { shelterAdmins: true, managers: true } },
        },
      });

      if (!doc) return;

      if (eventType === 'SHELTER_DOCUMENT_UPLOADED') {
        notifType = NotificationType.SHELTER_DOCUMENT_UPLOADED;
        title = 'New Shelter Document Uploaded';
        message = `A new document "${additionalData.name}" has been uploaded by ${doc.shelter.name}.`;
        recipients = await this.getAdmins();
      } else {
        notifType = additionalData.approved
          ? NotificationType.SHELTER_DOCUMENT_APPROVED
          : NotificationType.SHELTER_DOCUMENT_REJECTED;
        title = `Shelter Document ${additionalData.approved ? 'Approved' : 'Rejected'}`;
        message = `Your document "${doc.name}" has been ${additionalData.approved ? 'approved' : 'rejected'}.`;
        recipients = [
          ...doc.shelter.shelterAdmins.map((a: { id: string }) => a.id),
          ...doc.shelter.managers.map((m: { id: string }) => m.id),
        ];
      }

      await this.createAndEmitNotification(
        notifType,
        title,
        message,
        recipients,
        {
          performedBy:
            eventType === 'SHELTER_DOCUMENT_UPLOADED' ? 'SHELTER' : 'ADMIN',
          recordType: 'ShelterDocument',
          recordId: entityId,
          others: {
            documentName: doc.name,
            documentType: doc.type,
            shelterId: doc.shelterId,
          },
        },
        settings,
      );
    } else if (eventType.includes('DRIVER')) {
      const driver = await this.prisma.client.driver.findUnique({
        where: { id: entityId },
        include: { user: true },
      });

      if (!driver) return;

      if (eventType === 'DRIVER_DOCUMENT_UPLOADED') {
        notifType = NotificationType.DRIVER_DOCUMENT_UPLOADED;
        title = 'New Driver Document Uploaded';
        message = `Driver ${driver.user.name} has uploaded a new ${additionalData.type} document.`;
        recipients = await this.getAdmins();
      } else {
        notifType = additionalData.approved
          ? NotificationType.DRIVER_DOCUMENT_APPROVED
          : NotificationType.DRIVER_DOCUMENT_REJECTED;
        title = `Driver Document ${additionalData.approved ? 'Approved' : 'Rejected'}`;
        message = `Your ${additionalData.type} document has been ${additionalData.approved ? 'approved' : 'rejected'}.`;
        recipients = [driver.userId];
      }

      await this.createAndEmitNotification(
        notifType,
        title,
        message,
        recipients,
        {
          performedBy:
            eventType === 'DRIVER_DOCUMENT_UPLOADED' ? 'DRIVER' : 'ADMIN',
          recordType: 'Driver',
          recordId: entityId,
          others: {
            documentType: additionalData.type,
            driverName: driver.user.name,
          },
        },
        settings,
      );
    } else {
      const vet = await this.prisma.client.veterinarian.findUnique({
        where: { id: additionalData.vetId || entityId },
        include: { user: true },
      });

      if (!vet) return;

      if (eventType === 'VET_DOCUMENT_UPLOADED') {
        notifType = NotificationType.VET_DOCUMENT_UPLOADED;
        title = 'New Vet Document Uploaded';
        message = `Veterinarian ${vet.user.name} has uploaded a new document "${additionalData.name}".`;
        recipients = await this.getAdmins();
      } else {
        notifType = additionalData.approved
          ? NotificationType.VET_DOCUMENT_APPROVED
          : NotificationType.VET_DOCUMENT_REJECTED;
        title = `Vet Document ${additionalData.approved ? 'Approved' : 'Rejected'}`;
        message = `Your document "${additionalData.name}" has been ${additionalData.approved ? 'approved' : 'rejected'}.`;
        recipients = [vet.userId];
      }

      await this.createAndEmitNotification(
        notifType,
        title,
        message,
        recipients,
        {
          performedBy: eventType === 'VET_DOCUMENT_UPLOADED' ? 'VET' : 'ADMIN',
          recordType: 'VetDocument',
          recordId: entityId,
          others: {
            documentName: additionalData.name,
            documentType: additionalData.type,
            vetId: vet.id,
          },
        },
        settings,
      );
    }
  }
}
