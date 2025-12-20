import { Module } from '@nestjs/common';
import { ManageVetAppointmentService } from './services/manage-vet-appointment.service';
import { ManageVetClearanceService } from './services/manage-vet-clearance.service';
import { VetAppointmentService } from './services/vet-appointment.service';
import { VetClearanceService } from './services/vet-clearance.service';
import { VetClearanceAppointmentController } from './vet-clearance-appointment.controller';

@Module({
  controllers: [VetClearanceAppointmentController],
  providers: [
    VetClearanceService,
    VetAppointmentService,
    ManageVetAppointmentService,
    ManageVetClearanceService,
  ],
})
export class VetClearanceAppointmentModule {}
