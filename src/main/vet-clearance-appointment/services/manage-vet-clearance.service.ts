import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { VetClearanceRequestStatus } from '@prisma';
import { CreateVetAppointmentDto } from '../dto/vet-appointment.dto';
import {
    MakeNotFitDto,
    VetClearanceAction,
    VetClearanceActionDto,
} from '../dto/vet-clearance.dto';

@Injectable()
export class ManageVetClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Unable to approve/reject vet clearance request')
  async approveRrRejectAVetClearanceRequest(
    userId: string,
    id: string,
    dto: VetClearanceActionDto,
  ) {
    const { request } = await this.getRequestForVeterinarian(userId, id);

    if (
      !['PENDING_REVIEW', 'PENDING_EVALUATION', 'NEEDS_VISIT'].includes(
        request.status,
      )
    )
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Request is not pending or needs visit',
      );

    const newStatus = this.mapVetClearanceAction(dto.action);

    const updatedRequest = await this.prisma.client.vetClearanceRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    // TODO: NOTIFICATION - Vet Clearance Request Status Changed
    // What: Send notification about vet clearance decision
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via request -> transport -> shelterId)
    //   2. All users with role ADMIN or SUPER_ADMIN
    // Settings: emailNotifications, certificateNotifications
    // Meta: { requestId: id, transportId: (fetch from request), shelterId: (fetch from transport), newStatus, action: dto.action, veterinarianId: request.veterinarianId }

    return successResponse(updatedRequest, 'Request updated successfully');
  }

  @HandleError('Unable to make vet clearance request not fit for transport')
  async makeAVetClearanceRequestNotFitForTransport(
    userId: string,
    id: string,
    dto: MakeNotFitDto,
  ) {
    await this.getRequestForVeterinarian(userId, id);

    const updatedRequest = await this.prisma.client.vetClearanceRequest.update({
      where: { id },
      data: { status: 'NOT_FIT', notFitReasons: dto.notFitReasons },
    });

    // TODO: NOTIFICATION - Animal Marked Not Fit for Transport
    // What: Send notification that animal cannot be transported
    // Recipients:
    //   1. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via request -> transport -> shelterId)
    //   2. Assigned driver (if exists in related transport) - via driver.userId
    //   3. All users with role ADMIN or SUPER_ADMIN
    // Settings: emailNotifications, certificateNotifications, tripNotifications
    // Meta: { requestId: id, transportId: (fetch from request), shelterId: (fetch from transport), notFitReasons: dto.notFitReasons, veterinarianId: (fetch from request) }

    return successResponse(updatedRequest, 'Request updated successfully');
  }

  @HandleError('Unable to make an appointment for vet clearance request')
  async makeAnAppointmentForVetClearanceRequest(
    userId: string,
    id: string,
    dto: CreateVetAppointmentDto,
  ) {
    const { veterinarian, request } = await this.getRequestForVeterinarian(
      userId,
      id,
    );

    const vetAppointment = await this.prisma.client.vetAppointment.create({
      data: {
        veterinarianId: veterinarian.id,
        requestId: request.id,
        appointmentDate: new Date(dto.appointmentDate),
      },
    });

    // TODO: NOTIFICATION - Vet Appointment Scheduled
    // What: Send notification about scheduled vet appointment
    // Recipients:
    //   1. The veterinarian (veterinarian.id -> vet.userId)
    //   2. All SHELTER_ADMIN and MANAGER users of the related transport's shelter (fetch via request -> transport -> shelterId)
    // Settings: appointmentNotifications, emailNotifications
    // Meta: { appointmentId: vetAppointment.id, requestId: id, transportId: (fetch from request), shelterId: (fetch from transport), veterinarianId: veterinarian.id, appointmentDate: dto.appointmentDate }

    return successResponse(
      vetAppointment,
      'Appointment scheduled successfully',
    );
  }

  private async getRequestForVeterinarian(userId: string, requestId: string) {
    const request = await this.prisma.client.vetClearanceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new AppError(HttpStatus.NOT_FOUND, 'Request not found');

    const veterinarian = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!veterinarian)
      throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');

    if (request.veterinarianId !== veterinarian.id)
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Request does not belong to user',
      );

    return { request, veterinarian };
  }

  private mapVetClearanceAction = (
    action: VetClearanceAction,
  ): VetClearanceRequestStatus => {
    switch (action) {
      case VetClearanceAction.APPROVE:
        return 'PENDING_EVALUATION';

      case VetClearanceAction.REJECT:
        return 'REJECTED';

      case VetClearanceAction.NEEDS_VISIT:
        return 'NEEDS_VISIT';

      case VetClearanceAction.FIT_FOR_TRANSPORT:
        return 'CERTIFIED';

      default:
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'Invalid vet clearance action',
        );
    }
  };
}
