import { PaginationDto } from '@/common/dto/pagination.dto';
import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationSettingsDto } from '../dto/notification.dto';
import { RegisterFcmTokenDto } from '../dto/fcm-token.dto';
import { AuthNotificationService } from '../services/auth-notification.service';

@ApiTags('Auth, Notification')
@Controller('auth')
export class AuthNotificationController {
  constructor(
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  @ApiOperation({ summary: 'Get Notification Setting' })
  @ApiBearerAuth()
  @Get('notification-setting')
  @ValidateAuth()
  async getNotificationSetting(@GetUser('sub') userId: string) {
    return this.authNotificationService.getNotificationSettings(userId);
  }

  @ApiOperation({ summary: 'Update Notification Setting' })
  @ApiBearerAuth()
  @Patch('notification-setting')
  @ValidateAuth()
  async updateVetShelterNotificationSetting(
    @GetUser('sub') userId: string,
    @Body() dto: NotificationSettingsDto,
  ) {
    return this.authNotificationService.updateNotificationSettings(userId, dto);
  }

  @ApiOperation({ summary: 'Get User Notifications' })
  @ApiBearerAuth()
  @Get('notifications')
  @ValidateAuth()
  async getUserNotifications(
    @GetUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.authNotificationService.getUserNotifications(userId, dto);
  }

  @ApiOperation({ summary: 'Mark All Notifications Read' })
  @ApiBearerAuth()
  @Patch('notifications')
  @ValidateAuth()
  asyncAllNotificationsRead(@GetUser('sub') userId: string) {
    return this.authNotificationService.markAllNotificationsRead(userId);
  }

  @ApiOperation({ summary: 'Register FCM Token' })
  @ApiBearerAuth()
  @Post('notification/token')
  @ValidateAuth()
  async registerFcmToken(
    @GetUser('sub') userId: string,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    return this.authNotificationService.registerFcmToken(userId, dto);
  }

  @ApiOperation({ summary: 'Mark Own Notification Read' })
  @ApiBearerAuth()
  @Patch('notifications/:notificationId')
  @ValidateAuth()
  async markNotificationRead(
    @Param('notificationId') notificationId: string,
    @GetUser('sub') userId: string,
  ) {
    return this.authNotificationService.markNotificationRead(
      notificationId,
      userId,
    );
  }
}
