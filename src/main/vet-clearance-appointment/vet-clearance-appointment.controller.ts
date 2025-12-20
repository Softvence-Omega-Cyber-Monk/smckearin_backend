import {
  GetUser,
  ValidateAuth,
  ValidateVeterinarian,
} from '@/core/jwt/jwt.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetVetClearanceDto } from './dto/vet-appointment-clearance.dto';
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
}
