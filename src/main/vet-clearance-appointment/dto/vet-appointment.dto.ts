import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class CreateVetAppointmentDto {
  @ApiProperty({
    description: 'Appointment date (ISO format)',
    example: '2025-12-20T10:30:00.000Z',
  })
  @IsISO8601()
  appointmentDate: string;
}
