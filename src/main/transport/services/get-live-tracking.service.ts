import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { TransportTrackingService } from '@/lib/queue/trip/transport-tracking.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetLiveTrackingService {
  constructor(private readonly trackingService: TransportTrackingService) {}

  @HandleError('Unable to fetch live tracking data')
  async getLiveTracking(transportId: string) {
    const liveData =
      await this.trackingService.getLiveTrackingData(transportId);
    return successResponse(liveData, 'Live tracking data fetched successfully');
  }
}
