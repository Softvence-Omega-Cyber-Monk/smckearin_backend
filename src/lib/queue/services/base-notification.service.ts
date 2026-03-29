import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../enums/notification-types.enum';
import { NotificationPayload } from '../interface/queue.payload';
import { QueueGateway } from '../queue.gateway';
import { FirebaseService } from '@/lib/firebase/firebase.service';

@Injectable()
export class BaseNotificationService {
  protected readonly logger = new Logger(BaseNotificationService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly queueGateway: QueueGateway,
    protected readonly firebaseService: FirebaseService,
  ) {}

  // ==================== HELPER METHODS ====================

  protected async getShelterAdmins(shelterId: string): Promise<string[]> {
    const shelter = await this.prisma.client.shelter.findUnique({
      where: { id: shelterId },
      include: { shelterAdmins: true },
    });
    return shelter?.shelterAdmins.map((a: { id: string }) => a.id) || [];
  }

  protected async getShelterTeam(shelterId: string): Promise<string[]> {
    const shelter = await this.prisma.client.shelter.findUnique({
      where: { id: shelterId },
      include: { shelterAdmins: true, managers: true },
    });
    return [
      ...(shelter?.shelterAdmins.map((a: { id: string }) => a.id) || []),
      ...(shelter?.managers.map((m: { id: string }) => m.id) || []),
    ];
  }

  protected async getAdmins(): Promise<string[]> {
    const admins = await this.prisma.client.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  protected async getSuperAdmins(): Promise<string[]> {
    const admins = await this.prisma.client.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  protected async checkNotificationSettings(
    userId: string,
    settingKeys: string[],
  ): Promise<boolean> {
    const settings = await this.prisma.client.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) return true; // Default to sending if no settings

    // Check if ANY of the required settings is enabled
    return settingKeys.some((key) => {
      const value = settings[key as keyof typeof settings];
      return value === true;
    });
  }

  protected async createAndEmitNotification(
    type: NotificationType,
    title: string,
    message: string,
    recipients: string[],
    meta: any,
    settingKeys: string[],
  ): Promise<void> {
    // Filter recipients based on their notification settings
    const filteredRecipients = await Promise.all(
      recipients.map(async (userId) => {
        const shouldSend = await this.checkNotificationSettings(
          userId,
          settingKeys,
        );
        return shouldSend ? userId : null;
      }),
    );

    const validRecipients = filteredRecipients.filter((id) => id !== null);

    if (validRecipients.length === 0) {
      this.logger.warn(`No valid recipients for notification type: ${type}`);
      return;
    }

    const payload: NotificationPayload = {
      type: QueueEventsEnum.NOTIFICATION,
      title,
      message,
      createdAt: new Date(),
      meta,
    };

    // Send via WebSocket (QueueGateway)
    for (const userId of validRecipients) {
      try {
        await this.queueGateway.notifySingleUser(
          userId,
          QueueEventsEnum.NOTIFICATION,
          payload,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send websocket notification to user ${userId}:`,
          error,
        );
      }
    }

    // Send via Firebase Push (FCM)
    const pushRecipients = await Promise.all(
      validRecipients.map(async (userId) => {
        const canSendPush = await this.checkNotificationSettings(userId, [
          'pushNotifications',
        ]);
        return canSendPush ? userId : null;
      }),
    );

    const pushTargetIds = pushRecipients.filter(
      (id) => id !== null,
    ) as string[];

    if (pushTargetIds.length > 0 && this.firebaseService.isConfigured()) {
      const fcmTokens = await this.prisma.client.userFcmToken.findMany({
        where: { userId: { in: pushTargetIds } },
        select: { token: true },
      });

      const tokens = fcmTokens.map((t) => t.token);

      if (tokens.length > 0) {
        try {
          await this.firebaseService.sendToTokens(tokens, {
            title,
            body: message,
            data: {
              ...(meta || {}),
              type: String(type),
              createdAt: payload.createdAt.toISOString(),
            },
          });
          this.logger.log(`FCM push sent to ${tokens.length} tokens`);
        } catch (error) {
          this.logger.error('Failed to send FCM push notification:', error);
        }
      }
    }

    this.logger.log(
      `Notification sent: ${type} to ${validRecipients.length} recipients`,
    );
  }
}
