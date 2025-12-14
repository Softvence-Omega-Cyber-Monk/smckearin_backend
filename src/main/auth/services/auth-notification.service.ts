import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  successPaginatedResponse,
  successResponse,
  TResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationSettings, UserRole } from '@prisma';

@Injectable()
export class AuthNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get notification settings')
  async createOrGetNotificationSetting(
    userId: string,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { notificationSettings: true },
    });

    const settings = await this.prisma.client.notificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return successResponse(
      this.filterSettingsByRole(user.role, settings),
      'Notification settings created or fetched',
    );
  }

  @HandleError('Failed to update notification settings')
  async updateNotificationSettings(
    userId: string,
    dto: Partial<NotificationSettings>,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { notificationSettings: true },
    });

    const updated = await this.prisma.client.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    return successResponse(
      this.filterSettingsByRole(user.role, updated),
      'Notification settings updated',
    );
  }

  @HandleError('Failed to fetch user notifications')
  async getUserNotifications(userId: string, dto: PaginationDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 40;
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.prisma.client.$transaction([
      this.prisma.client.userNotification.findMany({
        where: { userId },
        include: { notification: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.userNotification.count({ where: { userId } }),
    ]);

    const formatted = notifications.map((n) => ({
      id: n.notification.id,
      type: n.notification.type,
      title: n.notification.title,
      message: n.notification.message,
      meta: n.notification.meta,
      read: n.read,
      createdAt: n.createdAt,
    }));

    return successPaginatedResponse(
      formatted,
      { page, limit, total },
      'Notifications fetched',
    );
  }

  @HandleError('Failed to mark notification as read')
  async markNotificationRead(notificationId: string, userId: string) {
    const notification =
      await this.prisma.client.userNotification.findUniqueOrThrow({
        where: { id: notificationId },
        include: { notification: true, user: true },
      });

    if (notification && userId !== notification.userId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'You are not authorized to mark this notification as read',
      );
    }

    await this.prisma.client.userNotification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return successResponse(null, 'Notification marked as read');
  }

  @HandleError('Failed to mark notifications as read')
  async markAllNotificationsRead(userId: string) {
    await this.prisma.client.userNotification.updateMany({
      where: { userId },
      data: { read: true },
    });

    return successResponse(null, 'All notifications marked as read');
  }

  private filterSettingsByRole(role: UserRole, settings: NotificationSettings) {
    const common = {
      id: settings.id,
      userId: settings.userId,
      emailNotifications: settings.emailNotifications,
      smsNotifications: settings.smsNotifications,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    switch (role) {
      case 'SHELTER_ADMIN':
      case 'MANAGER':
      case 'VETERINARIAN':
        return {
          ...common,
          certificateNotifications: settings.certificateNotifications,
          appointmentNotifications: settings.appointmentNotifications,
        };

      case 'DRIVER':
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return {
          ...common,
          tripNotifications: settings.tripNotifications,
          paymentNotifications: settings.paymentNotifications,
        };

      default:
        return common;
    }
  }
}
