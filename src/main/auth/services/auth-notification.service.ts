import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  successPaginatedResponse,
  successResponse,
  TResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationSettings } from '@prisma';

@Injectable()
export class AuthNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get notification settings')
  async createOrGetNotificationSetting(
    userId: string,
  ): Promise<TResponse<NotificationSettings>> {
    const notificationSettings =
      await this.prisma.client.notificationSettings.upsert({
        where: { userId },
        create: {
          user: { connect: { id: userId } },
        },
        update: {}, // do nothing if already exists
      });

    return successResponse(
      notificationSettings,
      'Notification settings created or fetched',
    );
  }

  @HandleError('Failed to update notification settings')
  async updateNotificationSettings(
    userId: string,
    dto: Partial<NotificationSettings>,
  ): Promise<TResponse<NotificationSettings>> {
    const settings = await this.prisma.client.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    return successResponse(settings, 'Notification settings updated');
  }

  @HandleError('Failed to fetch user notifications')
  async getUserNotifications(userId: string, dto: PaginationDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 40;
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.prisma.client.$transaction([
      this.prisma.client.userNotification.findMany({
        where: { userId },
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.userNotification.count({ where: { userId } }),
    ]);

    // Map to clean response
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

  @HandleError('Failed to fetch all notifications')
  async getAllNotifications(dto: PaginationDto) {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 40;
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.prisma.client.$transaction([
      this.prisma.client.userNotification.findMany({
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.userNotification.count(),
    ]);

    // Map to clean response
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
  async markNotificationRead(notificationId: string) {
    await this.prisma.client.userNotification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return successResponse(null, 'Notification marked as read');
  }

  @HandleError('Failed to mark notifications as read')
  async markAllNotificationsRead(userId: string) {
    await this.prisma.client.userNotification.updateMany({
      where: {
        userId,
      },
      data: { read: true },
    });

    return successResponse(null, 'All Notifications marked as read');
  }
}
