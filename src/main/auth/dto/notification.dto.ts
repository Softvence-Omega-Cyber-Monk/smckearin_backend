import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CommonNotificationSettingsDto {
  @ApiProperty({ description: 'Enable email notifications', default: true })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ description: 'Enable SMS notifications', default: false })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;
}

export class ShelterVetNotificationSettingsDto extends CommonNotificationSettingsDto {
  @ApiProperty({ description: 'Certificate notifications', default: false })
  @IsOptional()
  @IsBoolean()
  certificateNotifications?: boolean;

  @ApiProperty({ description: 'Appointment notifications', default: true })
  @IsOptional()
  @IsBoolean()
  appointmentNotifications?: boolean;
}

export class AdminDriverNotificationSettingsDto extends CommonNotificationSettingsDto {
  @ApiProperty({ description: 'Trip notifications', default: true })
  @IsOptional()
  @IsBoolean()
  tripNotifications?: boolean;

  @ApiProperty({ description: 'Payment notifications', default: false })
  @IsOptional()
  @IsBoolean()
  paymentNotifications?: boolean;
}

export class NotificationSettingsDto extends CommonNotificationSettingsDto {
  @ApiProperty({ description: 'Certificate notifications', default: false })
  @IsOptional()
  @IsBoolean()
  certificateNotifications?: boolean;

  @ApiProperty({ description: 'Appointment notifications', default: true })
  @IsOptional()
  @IsBoolean()
  appointmentNotifications?: boolean;

  @ApiProperty({ description: 'Trip notifications', default: true })
  @IsOptional()
  @IsBoolean()
  tripNotifications?: boolean;

  @ApiProperty({ description: 'Payment notifications', default: false })
  @IsOptional()
  @IsBoolean()
  paymentNotifications?: boolean;
}
