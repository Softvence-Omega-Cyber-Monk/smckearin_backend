import {
  GetUser,
  ValidateAuth,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetVetClearanceDto,
  VetClearanceActionDto,
} from './dto/vet-appointment-clearance.dto';
import { ManageVetAppointmentService } from './services/manage-vet-appointment.service';
import { ManageVetClearanceService } from './services/manage-vet-clearance.service';
import { VetAppointmentService } from './services/vet-appointment.service';
import { VetClearanceService } from './services/vet-clearance.service';

@ApiTags('Vet Clearance, Appointment, Certificate')
@ApiBearerAuth()
@ValidateAuth()
@Controller('vca')
export class VetClearanceAppointmentController {
  constructor(
    private readonly manageVetClearanceService: ManageVetClearanceService,
    private readonly manageVetAppointmentService: ManageVetAppointmentService,
    private readonly vetAppointmentService: VetAppointmentService,
    private readonly vetClearanceService: VetClearanceService,
  ) {}

  @ApiOperation({ summary: 'Get own vet clearance requests' })
  @Get('vet/clearance-requests')
  @ValidateVeterinarian()
  async getOwnVetClearanceRequests(
    @GetUser('sub') userId: string,
    @Query() dto: GetVetClearanceDto,
  ) {
    return this.vetClearanceService.getOwnVetClearanceRequests(userId, dto);
  }

  @ApiOperation({ summary: 'Get single vet clearance request' })
  @Get('vet/clearance-requests/:id')
  async getSingleVetClearanceRequest(@Param('id') id: string) {
    return this.vetClearanceService.getSingleVetClearanceRequest(id);
  }

  @ApiOperation({ summary: 'Approve or reject vet clearance request' })
  @Patch('vet/clearance-requests/:id/action')
  @ValidateVeterinarian()
  async manageOwnVetClearanceRequest(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
    @Query() dto: VetClearanceActionDto,
  ) {
    return this.manageVetClearanceService.approveRrRejectAVetClearanceRequest(
      userId,
      id,
      dto,
    );
  }
}
