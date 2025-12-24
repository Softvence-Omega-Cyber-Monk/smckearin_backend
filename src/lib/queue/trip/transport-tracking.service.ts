import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { errorResponse, successResponse } from '@/common/utils/response.util';
import { simplifyError } from '@/core/error/handle-error.simplify';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';
import { TransportLocationUpdateDto } from '../dto/transport-tracking.dto';
import { QueueGateway } from '../queue.gateway';

@Injectable()
export class TransportTrackingService {
  private logger = new Logger(TransportTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
    @Inject(forwardRef(() => QueueGateway))
    private readonly gateway: QueueGateway,
  ) {}

  async updateLocation(client: Socket, payload: TransportLocationUpdateDto) {
    try {
      this.logger.log(`Updating location for transport ${payload.transportId}`);

      const userId = client.data.userId;

      const user = await this.prisma.client.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true },
      });

      const driver = await this.prisma.client.driver.findUniqueOrThrow({
        where: { userId: user.id },
        select: { id: true },
      });

      const driverId = driver?.id;
      const { transportId, latitude, longitude } = payload;

      // check driver ownership
      const transport = await this.prisma.client.transport.findUniqueOrThrow({
        where: { id: transportId },
        select: { driverId: true },
      });

      if (transport?.driverId !== driverId) {
        return errorResponse(null, 'Transport does not belong to this driver');
      }

      // validate location
      const isValid = await this.googleMaps.validateCoordinates(
        latitude,
        longitude,
      );

      if (!isValid) {
        return errorResponse(null, 'Invalid location');
      }

      // 1. Save to TransportTimeline
      await this.prisma.client.transportTimeline.create({
        data: {
          transportId,
          status: 'IN_TRANSIT',
          latitude,
          longitude,
          note: 'Driver live location',
        },
      });

      // 2. Update Driver's current location and last ping
      await this.prisma.client.driver.update({
        where: { id: driverId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationPing: new Date(),
        },
      });

      // 3. Prepare payload
      const eventPayload = successResponse(
        {
          transportId,
          driverId,
          latitude,
          longitude,
          timestamp: new Date(),
        },
        'Location updated',
      );

      // 3. Emit to all connected clients tracking this transport
      this.gateway.emitToRoom(
        `transport-${transportId}`,
        QueueEventsEnum.TRANSPORT_LOCATION_UPDATE,
        eventPayload,
      );

      return eventPayload;
    } catch (error: any) {
      this.logger.error('Failed to update transport location', error.stack);
      // Use simplifyError to handle known error types
      try {
        simplifyError(error, 'Failed to update location', 'Transport');
      } catch (simplifiedError: any) {
        return errorResponse(null, simplifiedError.message);
      }
    }
  }
}
