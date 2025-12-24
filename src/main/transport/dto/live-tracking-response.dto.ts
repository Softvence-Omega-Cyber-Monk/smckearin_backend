import { ApiProperty } from '@nestjs/swagger';

export class MilestoneDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  distanceFromPickup: number;

  @ApiProperty()
  eta: Date;
}

export class LiveTrackingResponseDto {
  @ApiProperty()
  transportId: string;

  @ApiProperty()
  animalName: string;

  @ApiProperty()
  animalBreed: string;

  @ApiProperty()
  primaryAnimalId: string;

  @ApiProperty({ required: false })
  bondedAnimalId?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  pickUpLocation: string;

  @ApiProperty()
  dropOffLocation: string;

  @ApiProperty()
  currentLatitude?: number;

  @ApiProperty()
  currentLongitude?: number;

  @ApiProperty()
  driverConnected: boolean;

  @ApiProperty()
  lastLocationPing?: Date;

  @ApiProperty()
  totalDistance: number;

  @ApiProperty()
  distanceRemaining: number;

  @ApiProperty()
  progressPercentage: number;

  @ApiProperty()
  estimatedTotalTimeMinutes: number;

  @ApiProperty()
  estimatedTimeRemainingMinutes: number;

  @ApiProperty()
  estimatedDropoffTime: Date;

  @ApiProperty({ type: [MilestoneDto] })
  milestones: MilestoneDto[];

  @ApiProperty()
  routePolyline: string;
}
