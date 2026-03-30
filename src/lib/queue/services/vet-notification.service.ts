import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '../enums/notification-types.enum';
import { QueueGateway } from '../queue.gateway';
import { BaseNotificationService } from './base-notification.service';
import { FirebaseService } from '@/lib/firebase/firebase.service';

@Injectable()
export class VetNotificationService extends BaseNotificationService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueGateway: QueueGateway,
    protected readonly firebaseService: FirebaseService,
  ) {
    super(prisma, queueGateway, firebaseService);
  }

  // ==================== VET CLEARANCE EVENTS ====================

  async notifyVetClearanceEvent(
    eventType: 'STATUS_CHANGED' | 'NOT_FIT',
    requestId: string,
    additionalData: any,
  ) {
    const request = await this.prisma.client.vetClearanceRequest.findUnique({
      where: { id: requestId },
      include: {
        transport: {
          include: {
            shelter: { include: { shelterAdmins: true, managers: true } },
            driver: { include: { user: true } },
          },
        },
      },
    });

    if (!request || !request.transport) return;

    const shelterTeam = [
      ...(request.transport.shelter?.shelterAdmins.map((a) => a.id) || []),
      ...(request.transport.shelter?.managers.map((m) => m.id) || []),
    ];

    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [...shelterTeam, ...(await this.getAdmins())];
    const settings: string[] = [
      'emailNotifications',
      'certificateNotifications',
      'pushNotifications',
    ];

    if (eventType === 'STATUS_CHANGED') {
      notifType = NotificationType.VET_CLEARANCE_STATUS_CHANGED;
      title = 'Vet Clearance Status Updated';
      message = `Vet clearance status has been updated to ${additionalData.newStatus}.`;
    } else {
      notifType = NotificationType.ANIMAL_NOT_FIT_FOR_TRANSPORT;
      title = 'Animal Not Fit for Transport';
      message = `The animal has been marked as not fit for transport. Reasons: ${additionalData.notFitReasons.join(', ')}`;
      recipients = [
        ...recipients,
        ...(request.transport.driver ? [request.transport.driver.userId] : []),
      ];
      settings.push('tripNotifications');
    }

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy: 'VET',
        recordType: 'VetClearanceRequest',
        recordId: requestId,
        others: {
          transportId: request.transport.id,
          shelterId: request.transport.shelterId,
          newStatus: additionalData.newStatus,
          notFitReasons: additionalData.notFitReasons,
        },
      },
      settings,
    );
  }

  // ==================== APPOINTMENT EVENTS ====================

  async notifyAppointmentEvent(
    eventType:
      | 'SCHEDULED'
      | 'STATUS_UPDATED'
      | 'CANCELLED'
      | 'COMPLETED'
      | 'MISSED',
    appointmentId: string,
    additionalData?: any,
  ) {
    const appointment = await this.prisma.client.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        request: {
          include: {
            transport: {
              include: {
                shelter: { include: { shelterAdmins: true, managers: true } },
                driver: { include: { user: true } },
              },
            },
          },
        },
        veterinarian: { include: { user: true } },
      },
    });

    if (!appointment || !appointment.request.transport) return;

    const shelterTeam = [
      ...(appointment.request.transport.shelter?.shelterAdmins.map(
        (a: any) => a.id,
      ) || []),
      ...(appointment.request.transport.shelter?.managers.map(
        (m: any) => m.id,
      ) || []),
    ];

    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [...shelterTeam];
    const settings: string[] = [
      'appointmentNotifications',
      'emailNotifications',
      'pushNotifications',
    ];

    switch (eventType) {
      case 'SCHEDULED':
        notifType = NotificationType.VET_APPOINTMENT_SCHEDULED;
        title = 'Vet Appointment Scheduled';
        message = `A vet appointment has been scheduled for ${new Date(appointment.appointmentDate).toLocaleDateString()}.`;
        if (appointment.veterinarian && appointment.veterinarian.user) {
          recipients = [appointment.veterinarian.user.id, ...recipients];
        }
        break;

      case 'STATUS_UPDATED':
        notifType = NotificationType.VET_APPOINTMENT_STATUS_UPDATED;
        title = 'Appointment Status Updated';
        message = `Vet appointment status has been updated to ${additionalData.status}.`;
        recipients = [...recipients, ...(await this.getAdmins())];
        break;

      case 'CANCELLED':
        notifType = NotificationType.VET_APPOINTMENT_CANCELLED;
        title = 'Vet Appointment Cancelled';
        message = 'The vet appointment has been cancelled.';
        recipients = [...recipients, ...(await this.getAdmins())];
        break;

      case 'COMPLETED':
        notifType = NotificationType.VET_APPOINTMENT_COMPLETED;
        title = 'Vet Appointment Completed';
        message = 'The vet appointment has been completed.';
        recipients = [
          ...recipients,
          ...(appointment.request.transport.driver
            ? [appointment.request.transport.driver.userId]
            : []),
        ];
        settings.push('tripNotifications');
        break;

      case 'MISSED':
        notifType = NotificationType.VET_APPOINTMENT_MISSED;
        title = 'Vet Appointment Missed';
        message = 'The vet appointment was missed.';
        recipients = [...recipients, ...(await this.getAdmins())];
        break;
    }

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy: 'VET',
        recordType: 'VetAppointment',
        recordId: appointmentId,
        others: {
          appointmentDate: appointment.appointmentDate,
          transportId: appointment.request.transport.id,
          shelterId: appointment.request.transport.shelterId,
          status: additionalData?.status,
        },
      },
      settings,
    );
  }

  // ==================== HEALTH REPORT EVENTS ====================

  async notifyHealthReportEvent(
    eventType: 'APPROVED' | 'REJECTED' | 'UPDATED' | 'DELETED',
    reportId: string,
    additionalData?: any,
  ) {
    this.logger.log('Notifying Health Report Event', additionalData);
    const report = await this.prisma.client.healthReport.findUnique({
      where: { id: reportId },
      include: {
        veterinarian: { include: { user: true } },
        animal: {
          include: {
            shelter: { include: { shelterAdmins: true, managers: true } },
          },
        },
      },
    });

    if (!report) return;

    const shelterTeam = [
      ...(report.animal.shelter?.shelterAdmins.map((a) => a.id) || []),
      ...(report.animal.shelter?.managers.map((m) => m.id) || []),
    ];

    let notifType: NotificationType;
    let title: string;
    let message: string;
    let recipients: string[] = [];
    const settings: string[] = [
      'emailNotifications',
      'certificateNotifications',
      'pushNotifications',
    ];

    switch (eventType) {
      case 'APPROVED':
        notifType = NotificationType.HEALTH_REPORT_APPROVED;
        title = 'Health Report Approved';
        message = `Health report for ${report.animal.name} has been approved.`;
        recipients = [report.veterinarian.userId, ...shelterTeam];
        break;

      case 'REJECTED':
        notifType = NotificationType.HEALTH_REPORT_REJECTED;
        title = 'Health Report Rejected';
        message = `Health report for ${report.animal.name} has been rejected.`;
        recipients = [report.veterinarian.userId, ...shelterTeam];
        break;

      case 'UPDATED':
        notifType = NotificationType.HEALTH_REPORT_UPDATED;
        title = 'Health Report Updated';
        message = `Health report for ${report.animal.name} has been updated.`;
        recipients = [...shelterTeam, ...(await this.getAdmins())];
        break;

      case 'DELETED':
        notifType = NotificationType.HEALTH_REPORT_DELETED;
        title = 'Health Report Deleted';
        message = `Health report for ${report.animal.name} has been deleted.`;
        recipients = [...shelterTeam, ...(await this.getAdmins())];
        break;
    }

    await this.createAndEmitNotification(
      notifType,
      title,
      message,
      recipients,
      {
        performedBy:
          eventType === 'UPDATED' || eventType === 'DELETED' ? 'VET' : 'ADMIN',
        recordType: 'HealthReport',
        recordId: reportId,
        others: {
          animalName: report.animal.name,
          animalId: report.animalId,
          shelterId: report.animal.shelterId,
          reportType: report.reportType,
        },
      },
      settings,
    );
  }
}
