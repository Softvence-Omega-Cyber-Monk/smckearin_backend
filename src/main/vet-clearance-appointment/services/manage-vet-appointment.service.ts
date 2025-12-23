import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { VetNotificationService } from '@/lib/queue/services/vet-notification.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { UpdateVetAppointmentStatusDto } from '../dto/vet-appointment.dto';

@Injectable()
export class ManageVetAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vetNotificationService: VetNotificationService,
  ) {}

  private async checkOwnership(userId: string, appointmentId: string) {
    const vet = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!vet)
      throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');

    const appointment = await this.prisma.client.vetAppointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment)
      throw new AppError(HttpStatus.NOT_FOUND, 'Appointment not found');

    if (appointment.veterinarianId !== vet.id)
      throw new AppError(HttpStatus.FORBIDDEN, 'Not your appointment');

    return { vet, appointment };
  }

  @HandleError('Failed to update appointment status')
  async updateAppointmentStatus(
    userId: string,
    appointmentId: string,
    dto: UpdateVetAppointmentStatusDto,
  ) {
    await this.checkOwnership(userId, appointmentId);

    const updated = await this.prisma.client.vetAppointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
    });

    // TODO: NOTIFICATION - Vet Appointment Status Updated
    // What: Send notification about appointment status change
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via appointment -> request -> transport -> shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: appointmentNotifications, emailNotifications
    // Meta: { appointmentId, requestId: (fetch from appointment), transportId: (fetch from request), shelterId: (fetch from transport), newStatus: dto.status, veterinarianId: (fetch from appointment) }
    await this.vetNotificationService.notifyAppointmentEvent(
      'STATUS_UPDATED',
      appointmentId,
      { status: dto.status },
    );

    return successResponse(updated, 'Appointment status updated');
  }

  @HandleError('Failed to cancel appointment')
  async cancelAppointment(userId: string, appointmentId: string) {
    await this.checkOwnership(userId, appointmentId);

    const updated = await this.prisma.client.vetAppointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    // TODO: NOTIFICATION - Vet Appointment Cancelled
    // What: Send notification about appointment cancellation
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via appointment -> request -> transport -> shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: appointmentNotifications, emailNotifications
    // Meta: { appointmentId, requestId: (fetch from appointment), transportId: (fetch from request), shelterId: (fetch from transport), veterinarianId: (fetch from appointment) }
    await this.vetNotificationService.notifyAppointmentEvent(
      'CANCELLED',
      appointmentId,
    );

    return successResponse(updated, 'Appointment cancelled');
  }

  @HandleError('Failed to complete appointment')
  async completeAppointment(userId: string, appointmentId: string) {
    await this.checkOwnership(userId, appointmentId);

    const updated = await this.prisma.client.vetAppointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });

    // TODO: NOTIFICATION - Vet Appointment Completed
    // What: Send notification about appointment completion
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via appointment -> request -> transport -> shelterId)
    //   2. Assigned driver (if exists in related transport) - via driver.userId
    // Settings: appointmentNotifications, emailNotifications, tripNotifications
    // Meta: { appointmentId, requestId: (fetch from appointment), transportId: (fetch from request), shelterId: (fetch from transport), veterinarianId: (fetch from appointment) }
    await this.vetNotificationService.notifyAppointmentEvent(
      'COMPLETED',
      appointmentId,
    );

    return successResponse(updated, 'Appointment marked as completed');
  }

  @HandleError('Failed to mark appointment missed')
  async markMissed(userId: string, appointmentId: string) {
    await this.checkOwnership(userId, appointmentId);

    const updated = await this.prisma.client.vetAppointment.update({
      where: { id: appointmentId },
      data: { status: 'MISSED' },
    });

    // TODO: NOTIFICATION - Vet Appointment Missed
    // What: Send notification about missed appointment
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via appointment -> request -> transport -> shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: appointmentNotifications, emailNotifications
    // Meta: { appointmentId, requestId: (fetch from appointment), transportId: (fetch from request), shelterId: (fetch from transport), veterinarianId: (fetch from appointment) }
    await this.vetNotificationService.notifyAppointmentEvent(
      'MISSED',
      appointmentId,
    );

    return successResponse(updated, 'Appointment marked as missed');
  }

  @HandleError('Failed to delete appointment')
  async deleteAppointment(userId: string, appointmentId: string) {
    await this.checkOwnership(userId, appointmentId);

    const deleted = await this.prisma.client.vetAppointment.delete({
      where: { id: appointmentId },
    });

    return successResponse(deleted, 'Appointment deleted');
  }
}
