import { ApiProperty } from '@nestjs/swagger';
import { WorkingDay } from '@prisma';
import { IsArray, IsNotEmpty, Matches } from 'class-validator';

export class UpdateOperatingScheduleDto {
  @ApiProperty({ example: '09:00', description: 'Start time in HH:mm format' })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'End time in HH:mm format' })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiProperty({
    example: [WorkingDay.MONDAY, WorkingDay.TUESDAY],
    enum: WorkingDay,
    isArray: true,
  })
  @IsArray()
  workingDays: WorkingDay[];
}
