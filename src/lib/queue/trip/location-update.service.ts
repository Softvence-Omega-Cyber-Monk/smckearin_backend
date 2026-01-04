import { QueueEventsEnum } from '@/common/enum/queue-events.enum';
import { errorResponse, successResponse } from '@/common/utils/response.util';
import { simplifyError } from '@/core/error/handle-error.simplify';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  DriverLocationUpdateDto,
  TransportLocationUpdateDto,
} from '../dto/transport-tracking.dto';
import { QueueGateway } from '../queue.gateway';
import { TrackingDataService } from './tracking-data.service';

@Injectable()
export class LocationUpdateService {
  private logger = new Logger(LocationUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
    private readonly trackingData: TrackingDataService,
    @Inject(forwardRef(() => QueueGateway))
    private readonly gateway: QueueGateway,
  ) {}

  /**
   * Update location for a specific transport
   */
  async updateLocation(client: Socket, payload: TransportLocationUpdateDto) {
    try {
      this.logger.log(`Updating location for transport ${payload.transportId}`);

      const userId = client.data.userId;
      this.logger.log(`User ID: ${userId}`);

      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return errorResponse(null, 'User not found');
      }

      const driver = await this.prisma.client.driver.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!driver) {
        return errorResponse(null, 'Driver not found');
      }

      const driverId = driver?.id;
      const { transportId, latitude, longitude } = payload;

      // check driver ownership
      const transport = await this.prisma.client.transport.findUnique({
        where: { id: transportId },
        select: { driverId: true },
      });

      if (!transport) {
        return errorResponse(null, 'Transport not found');
      }

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

      // 3. Get Enriched Tracking Data
      const liveData = await this.trackingData.getLiveTrackingData(transportId);

      // 4. Prepare payload
      const eventPayload = successResponse(liveData, 'Location updated');

      // 5. Emit to all connected clients tracking this transport
      this.gateway.emitToRoom(
        `transport-${transportId}`,
        QueueEventsEnum.TRANSPORT_TRACKING_DATA,
        eventPayload,
      );

      return eventPayload;
    } catch (error: any) {
      this.logger.error('Failed to update transport location', error);
      try {
        simplifyError(error, 'Failed to update location', 'Transport');
      } catch (simplifiedError: any) {
        return errorResponse(null, simplifiedError.message);
      }
    }
  }

  /**
   * Update driver's current location and broadcast to all active transports
   */
  async updateDriverLocation(client: Socket, payload: DriverLocationUpdateDto) {
    try {
      const userId = client.data.userId;
      if (!userId) return errorResponse(null, 'Unauthorized');

      const driver = await this.prisma.client.driver.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!driver) return errorResponse(null, 'Driver not found');

      const { latitude, longitude, heading, speed } = payload;

      // 1. Update Driver's current location and last ping
      await this.prisma.client.driver.update({
        where: { id: driver.id },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationPing: new Date(),
        },
      });

      // 2. Find all active transports for this driver
      const activeTransports = await this.prisma.client.transport.findMany({
        where: {
          driverId: driver.id,
          status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
        select: { id: true },
      });

      if (activeTransports.length === 0) {
        return successResponse(
          null,
          'Driver location updated, no active transports',
        );
      }

      // 3. Update each active transport
      for (const transport of activeTransports) {
        try {
          // Save to TransportTimeline for each transport
          await this.prisma.client.transportTimeline.create({
            data: {
              transportId: transport.id,
              status: 'IN_TRANSIT',
              latitude,
              longitude,
              note: `Driver live location (Heading: ${heading ?? 'N/A'}, Speed: ${speed ?? 'N/A'})`,
            },
          });

          // Get Enriched Tracking Data
          const liveData = await this.trackingData.getLiveTrackingData(
            transport.id,
          );

          // Emit to all connected clients tracking this transport
          this.gateway.emitToRoom(
            `transport-${transport.id}`,
            QueueEventsEnum.TRANSPORT_TRACKING_DATA,
            successResponse(liveData, 'Location updated'),
          );
        } catch (e) {
          this.logger.error(`Failed to update transport ${transport.id}`, e);
        }
      }

      return successResponse(
        null,
        'Driver location updated and broadcasts sent',
      );
    } catch (error: any) {
      this.logger.error('Failed to update driver location', error);
      return errorResponse(null, 'Failed to update driver location');
    }
  }
}
