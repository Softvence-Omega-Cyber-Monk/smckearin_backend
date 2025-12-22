import { ApiProperty } from '@nestjs/swagger';
import { VetAppointmentStatus } from '@prisma';
import { IsEnum, IsISO8601 } from 'class-validator';

export class CreateVetAppointmentDto {
  @ApiProperty({
    description: 'Appointment date (ISO format)',
    example: '2025-12-20T10:30:00.000Z',
  })
  @IsISO8601()
  appointmentDate: string;
}

export class UpdateVetAppointmentStatusDto {
  @ApiProperty({
    enum: VetAppointmentStatus,
    example: VetAppointmentStatus.SCHEDULED,
    description: 'Appointment status',
  })
  @IsEnum(VetAppointmentStatus)
  status: VetAppointmentStatus;
}
