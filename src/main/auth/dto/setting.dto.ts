import { ApiProperty } from '@nestjs/swagger';
import { WorkingDay } from '@prisma';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

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
    example: 'MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY',
    description: 'Comma-separated list of working days',
  })
  @IsString()
  workingDays: string;
}

export class DailyScheduleEntryDto {
  @ApiProperty({
    example: 'MONDAY',
    enum: WorkingDay,
    description: 'The day of the week',
  })
  @IsEnum(WorkingDay, { message: 'day must be a valid WorkingDay' })
  day: WorkingDay;

  @ApiProperty({ example: '08:00', description: 'Start time in HH:mm format' })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({ example: '16:00', description: 'End time in HH:mm format' })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;
}

export class UpdateDailySchedulesDto {
  @ApiProperty({
    type: [DailyScheduleEntryDto],
    description:
      'Per-day schedule entries. Each day can have its own start/end time.',
    example: [
      { day: 'MONDAY', startTime: '08:00', endTime: '16:00' },
      { day: 'TUESDAY', startTime: '09:00', endTime: '17:00' },
      { day: 'SATURDAY', startTime: '10:00', endTime: '14:00' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one daily schedule entry is required' })
  @ValidateNested({ each: true })
  @Type(() => DailyScheduleEntryDto)
  schedules: DailyScheduleEntryDto[];
}
