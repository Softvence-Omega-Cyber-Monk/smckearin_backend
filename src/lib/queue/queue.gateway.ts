import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { successResponse } from '@/common/utils/response.util';
import { BaseGateway } from '@/core/socket/base.gateway';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { TransportLocationUpdateDto } from './dto/transport-tracking.dto';
import { NotificationPayload } from './interface/queue.payload';
import { TransportTrackingService } from './trip/transport-tracking.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:4173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://13.62.62.158:3000',
      'http://13.62.62.158:3001',
      'http://13.62.62.158:3002',
      'http://13.62.62.158:4173',
      'http://13.62.62.158:5173',
      'http://13.62.62.158:5174',
      'https://rescuetransit.ai',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  namespace: '/queue',
})
@Injectable()
export class QueueGateway extends BaseGateway {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly prisma: PrismaService,
    protected readonly jwtService: JwtService,
    private readonly transportTrackingService: TransportTrackingService,
  ) {
    super(configService, prisma, jwtService, QueueGateway.name);
  }

  /** --- NOTIFICATIONS --- */
  public getClients(userId: string): Set<Socket> {
    return this.clients.get(userId) || new Set();
  }

  public async notifySingleUser(
    userId: string,
    event: QueueEventsEnum,
    data: NotificationPayload,
  ) {
    const clients = this.getClients(userId);
    const notification = await this.prisma.client.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        meta: data.meta ?? {},
        users: { create: { userId } },
      },
    });

    const payload = { ...data, notificationId: notification.id };
    clients.forEach((client) => client.emit(event, payload));
    this.logger.log(`Notification sent to user ${userId} via ${event}`);
  }

  public async notifyMultipleUsers(
    userIds: string[],
    event: QueueEventsEnum,
    data: NotificationPayload,
  ) {
    userIds.forEach((id) => this.notifySingleUser(id, event, data));
  }

  public async notifyAllUsers(
    event: QueueEventsEnum,
    data: NotificationPayload,
  ) {
    // Get all user from DB
    const users = await this.prisma.client.user.findMany({
      select: { id: true },
    });

    // Store notification in DB for all users at once
    const notification = await this.prisma.client.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        meta: data.meta ?? {},
        users: {
          createMany: {
            data: users.map((u) => ({ userId: u.id })),
          },
        },
      },
    });

    // Check if any user is connected
    const userIds = Array.from(this.clients.keys());
    if (userIds.length === 0) {
      this.logger.warn('No users connected for notifyAllUsers');
      return;
    }

    // Add notificationId to payload
    const payload = { ...data, notificationId: notification.id };

    // Emit to all connected clients
    this.clients.forEach((clients) =>
      clients.forEach((client) => client.emit(event, payload)),
    );

    this.logger.log(`Notification stored & sent to all users via ${event}`);
  }

  public async emitToAdmins(event: QueueEventsEnum, data: NotificationPayload) {
    const admins = await this.prisma.client.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    if (!admins.length) return this.logger.warn('No admins found');

    const notification = await this.prisma.client.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        meta: data.meta ?? {},
        users: {
          createMany: {
            data: admins.map((a) => ({ userId: a.id })),
          },
        },
      },
    });

    const payload = { ...data, notificationId: notification.id };
    admins.forEach((a) =>
      this.getClients(a.id).forEach((c) => c.emit(event, payload)),
    );

    this.logger.log(
      `Notification sent to ${admins.length} admins via ${event}`,
    );
  }

  /** --- TRANSPORT --- */
  public joinTransportRoom(client: Socket, transportId: string) {
    const room = `transport-${transportId}`;
    client.join(room);
  }

  public emitToRoom(room: string, event: QueueEventsEnum, payload: any) {
    this.server.to(room).emit(event, payload);
  }

  public leaveTransportRoom(client: Socket, transportId: string) {
    const room = `transport-${transportId}`;
    client.leave(room);
  }

  // Transport handlers
  @SubscribeMessage(QueueEventsEnum.TRANSPORT_LOCATION_UPDATE)
  async handleUpdateLocation(client: Socket, dto: TransportLocationUpdateDto) {
    return this.transportTrackingService.updateLocation(client, dto);
  }

  @SubscribeMessage(QueueEventsEnum.TRANSPORT_JOIN_TRACKING)
  async handleJoinTracking(client: Socket, data: { transportId: string }) {
    this.joinTransportRoom(client, data.transportId);
    this.logger.log(
      `Client ${client.id} joined tracking for ${data.transportId}`,
    );

    // Automatically send initial data snapshot to the client who just joined
    const liveData = await this.transportTrackingService.getLiveTrackingData(
      data.transportId,
    );
    client.emit(
      QueueEventsEnum.TRANSPORT_TRACKING_DATA,
      successResponse(liveData, 'Initial tracking data'),
    );

    return successResponse(null, 'Joined transport tracking');
  }

  @SubscribeMessage(QueueEventsEnum.TRANSPORT_GET_LIVE_DATA)
  async handleGetLiveData(client: Socket, data: { transportId: string }) {
    const liveData = await this.transportTrackingService.getLiveTrackingData(
      data.transportId,
    );
    return successResponse(liveData, 'Live tracking data fetched');
  }

  @SubscribeMessage(QueueEventsEnum.TRANSPORT_LEAVE_TRACKING)
  async handleLeaveTracking(client: Socket, data: { transportId: string }) {
    this.leaveTransportRoom(client, data.transportId);
    this.logger.log(
      `Client ${client.id} left tracking for ${data.transportId}`,
    );
    return successResponse(null, 'Left transport tracking');
  }
}
