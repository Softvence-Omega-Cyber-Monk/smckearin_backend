import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { TrackingDataService } from '@/lib/queue/trip/tracking-data.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetLiveTrackingService {
  constructor(private readonly trackingDataService: TrackingDataService) {}

  @HandleError('Unable to fetch live tracking data')
  async getLiveTracking(transportId: string) {
    const liveData =
      await this.trackingDataService.getLiveTrackingData(transportId);
    return successResponse(liveData, 'Live tracking data fetched successfully');
  }
}
