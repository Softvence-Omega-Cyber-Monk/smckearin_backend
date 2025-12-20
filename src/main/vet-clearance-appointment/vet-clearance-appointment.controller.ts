import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ManageVetAppointmentService } from './services/manage-vet-appointment.service';
import { ManageVetClearanceService } from './services/manage-vet-clearance.service';
import { VetAppointmentService } from './services/vet-appointment.service';
import { VetClearanceService } from './services/vet-clearance.service';

@ApiTags('Vet Clearance, Appointment, Certificate')
@Controller('vet-clearance-appointment')
export class VetClearanceAppointmentController {
  constructor(
    private readonly manageVetClearanceService: ManageVetClearanceService,
    private readonly manageVetAppointmentService: ManageVetAppointmentService,
    private readonly vetClearanceService: VetAppointmentService,
    private readonly vetAppointmentService: VetClearanceService,
  ) {}
}
