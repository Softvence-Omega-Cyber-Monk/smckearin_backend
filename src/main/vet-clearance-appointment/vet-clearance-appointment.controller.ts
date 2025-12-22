import {
  GetUser,
  ValidateAuth,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTransportDto } from '../transport/dto/get-transport.dto';
import {
  CreateVetAppointmentDto,
  UpdateVetAppointmentStatusDto,
} from './dto/vet-appointment.dto';
import {
  GetVetClearanceDto,
  VetClearanceActionDto,
} from './dto/vet-clearance.dto';
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

  @ApiOperation({
    summary: 'Get single vet clearance request (all authorized users)',
  })
  @Get('vet/clearance-requests/:id')
  async getSingleVetClearanceRequest(@Param('id') id: string) {
    return this.vetClearanceService.getSingleVetClearanceRequest(id);
  }

  @ApiOperation({
    summary: 'Approve or reject vet clearance request (veterinarian)',
  })
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

  @ApiOperation({
    summary: 'Schedule an appointment for vet clearance request (veterinarian)',
  })
  @Patch('vet/clearance-requests/:id/appointment')
  @ValidateVeterinarian()
  async scheduleAAppointmentForVetClearanceRequest(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
    @Query() dto: CreateVetAppointmentDto,
  ) {
    return this.manageVetClearanceService.makeAnAppointmentForVetClearanceRequest(
      userId,
      id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get own vet appointments' })
  @Get('vet/appointments')
  @ValidateVeterinarian()
  async getOwnVetAppointments(
    @GetUser('sub') userId: string,
    dto: GetTransportDto,
  ) {
    return this.vetAppointmentService.getOwnVetAppointments(userId, dto);
  }

  @ApiOperation({
    summary: 'Get single vet appointment (all authorized users)',
  })
  @Get('vet/appointments/:id')
  async getSingleAppointment(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.vetAppointmentService.getSingleAppointment(userId, id);
  }

  @ApiOperation({
    summary: 'Mark an appointment as missed or completed (veterinarian)',
  })
  @ValidateVeterinarian()
  @Patch('vet/appointments/:id/status')
  async updateAppointmentStatus(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
    @Query() dto: UpdateVetAppointmentStatusDto,
  ) {
    return this.manageVetAppointmentService.updateAppointmentStatus(
      userId,
      id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Cancel an appointment (veterinarian)' })
  @ValidateVeterinarian()
  @Patch('vet/appointments/:id/cancel')
  async cancelAppointment(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.manageVetAppointmentService.cancelAppointment(userId, id);
  }

  @ApiOperation({ summary: 'Complete an appointment (veterinarian)' })
  @ValidateVeterinarian()
  @Patch('vet/appointments/:id/complete')
  async completeAppointment(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.manageVetAppointmentService.completeAppointment(userId, id);
  }

  @ApiOperation({ summary: 'Mark an appointment as missed (veterinarian)' })
  @ValidateVeterinarian()
  @Patch('vet/appointments/:id/missed')
  async markMissed(@GetUser('sub') userId: string, @Param('id') id: string) {
    return this.manageVetAppointmentService.markMissed(userId, id);
  }

  @ApiOperation({ summary: 'Delete an appointment (veterinarian)' })
  @ValidateVeterinarian()
  @Delete('vet/appointments/:id')
  async deleteAppointment(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.manageVetAppointmentService.deleteAppointment(userId, id);
  }
}
