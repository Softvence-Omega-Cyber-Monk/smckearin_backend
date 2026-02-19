# Transport Tracking Service Refactoring

## Overview

The `transport-tracking.service.ts` file (~731 lines) has been split into four smaller, focused services following the single responsibility principle.

## New Services

### 1. **TrackingHelperService** (`tracking-helper.service.ts`)

**Purpose:** Utility methods for distance calculations and polyline encoding

**Methods:**

- `calculateAirDistance()` - Calculate distance between two coordinates using Haversine formula
- `createSimplePolyline()` - Create a straight-line polyline with intermediate points
- `encodePolyline()` - Encode coordinates into Google's polyline format
- `encodeNumber()` - Private method for polyline number encoding

**Used by:** RouteCalculationService

---

### 2. **RouteCalculationService** (`route-calculation.service.ts`)

**Purpose:** Handle all route calculation logic including Google Maps API integration

**Main Method:**

- `calculateRoute()` - Main route calculation method

**Returns:**

```typescript
{
  routePolyline: string;
  totalDistance: number;
  distanceRemaining: number;
  progressPercentage: number;
  estimatedDropOffTime: Date | null;
  milestones: Array<{ name; distanceFromPickup; eta }>;
  estimatedTimeRemainingMinutes: number;
}
```

**Features:**

- Google Maps Routes API integration
- Duration parsing (handles multiple formats: "32s", "1h 32m", numeric values)
- Automatic fallback to air distance calculation when API fails
- Milestone generation from route steps
- Progress calculation

**Dependencies:** GoogleMapsService, TrackingHelperService

---

### 3. **TrackingDataService** (`tracking-data.service.ts`)

**Purpose:** Fetch and format enriched live tracking data

**Main Method:**

- `getLiveTrackingData(transportId)` - Returns complete tracking data

**Returns:** `LiveTrackingData` interface with:

- Transport and animal information
- Driver information and connectivity status
- Location data (current, pickup, dropoff)
- Route information (distance, progress, ETA)
- Milestones and timeline
- Shelter information

**Features:**

- Driver connectivity detection (based on last ping < 1 minute)
- Reverse geocoding for current location names
- Timeline filtering (keeps status changes + first/last in-transit)
- Distance conversion (meters → miles)

**Dependencies:** PrismaService, GoogleMapsService, RouteCalculationService

---

### 4. **LocationUpdateService** (`location-update.service.ts`)

**Purpose:** Handle location updates for both transports and drivers

**Methods:**

- `updateLocation()` - Update location for a specific transport
- `updateDriverLocation()` - Update driver's location for all active transports

**Features:**

- User authentication and driver ownership validation
- Coordinate validation via GoogleMapsService
- Database updates (TransportTimeline and Driver tables)
- Real-time broadcasting via QueueGateway
- Error handling and simplified error responses

**Dependencies:** PrismaService, GoogleMapsService, TrackingDataService, QueueGateway

---

### 5. **TransportTrackingService** (Updated)

**Purpose:** Main service that delegates to specialized services

**Status:** Now acts as a facade/delegator (marked with @deprecated comments)

**Methods:**

- `updateLocation()` → delegates to LocationUpdateService
- `updateDriverLocation()` → delegates to LocationUpdateService
- `getLiveTrackingData()` → delegates to TrackingDataService

---

## Module Registration

All services are registered in `queue.module.ts`:

```typescript
providers: [
  // Transport tracking services
  TrackingHelperService, // Utilities
  RouteCalculationService, // Route calculations
  TrackingDataService, // Data fetching/formatting
  LocationUpdateService, // Location updates
  TransportTrackingService, // Main facade (for backward compatibility)
  // ... other services
];
```

---

## Benefits

1. **Better Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Improved Testability**: Smaller services are easier to unit test
3. **Reusability**: Services can be used independently
4. **Maintainability**: Easier to understand and modify individual services
5. **Scalability**: Adding new features is simpler with focused services

---

## Backward Compatibility

The original `TransportTrackingService` is maintained as a facade, delegating to the new services. This ensures existing code continues to work without modifications.

---

## Migration Path (Optional)

For future improvements, consider:

1. **Direct Injection**: Update consumers to inject specific services instead of TransportTrackingService
2. **Remove Facade**: Once all consumers are updated, the facade can be removed
3. **Export Services**: Add new services to `queue.module.ts` exports if needed by other modules
