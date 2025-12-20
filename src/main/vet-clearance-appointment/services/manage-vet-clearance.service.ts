import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { UtilsService } from '@/lib/utils/services/utils.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { VetClearanceRequestStatus } from '@prisma';
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
    // Validate request belong to user
    const request = await this.prisma.client.vetClearanceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Request not found');
    }

    const veterinarian = await this.prisma.client.veterinarian.findUnique({
      where: { userId },
    });

    if (!veterinarian) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Veterinarian not found');
    }

    if (request.veterinarianId !== veterinarian.id) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'Request does not belong to user',
      );
    }

    if (
      request.status !== 'PENDING_REVIEW' &&
      request.status !== 'PENDING_EVALUATION' &&
      request.status !== 'NEEDS_VISIT'
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Request is not pending or needs visit',
      );
    }

    const newStatus = this.mapVetClearanceAction(dto.action);

    const updatedRequest = await this.prisma.client.vetClearanceRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    return successResponse(updatedRequest, 'Request updated successfully');
  }

  @HandleError('Unable to make vet clearance request not fit for transport')
  async makeAVetClearanceRequestNotFitForTransport(
    userId: string,
    id: string,
    dto: MakeNotFitDto,
  ) {
    const request = await this.prisma.client.vetClearanceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new AppError(HttpStatus.NOT_FOUND, 'Request not found');
    }

    const updatedRequest = await this.prisma.client.vetClearanceRequest.update({
      where: { id },
      data: { status: 'NOT_FIT', notFitReasons: dto.notFitReasons },
    });

    return successResponse(updatedRequest, 'Request updated successfully');
  }

  async makeAnAppointmentForVetClearanceRequest(
    userId: string,
    id: string,
    dto: MakeNotFitDto,
  ) {}

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
