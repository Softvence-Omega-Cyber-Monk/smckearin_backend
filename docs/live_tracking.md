# Live Trip Tracking - WebSocket API Documentation

This document outlines the real-time tracking implementation for the transport module.

## Connection Details

- **Namespace**: `/queue`
- **Transport**: `websocket` (required)
- **Authentication**: Connection requires a valid JWT sent via the `auth` object.

```javascript
const socket = io('your-api-url/queue', {
  auth: { token: 'Bearer <JWT_TOKEN>' },
  transports: ['websocket'],
});
```

---

## Events

### 1. Join Tracking Room

Join a specific transport tracking session to start receiving live updates.

- **Event**: `queue:transport_join_tracking`
- **Payload**: `{ transportId: string }`
- **Behavior**: You will immediately receive a `queue:transport_tracking_data` event with the current state upon successful join.

### 2. Leave Tracking Room

Stop receiving updates for a transport.

- **Event**: `queue:transport_leave_tracking`
- **Payload**: `{ transportId: string }`

### 3. Driver Location Update (Client -> Server)

Mobile apps should emit this event periodically (e.g., every 5-10 seconds) to update the driver's real-time position.

- **Event**: `queue:transport_location_update`
- **Payload**:

```json
{
  "transportId": "string",
  "latitude": number,
  "longitude": number
}
```

### 4. Receive Live Updates (Server -> Client)

The server broadcasts this event whenever a location update is received or a driver pings.

- **Event**: `queue:transport_tracking_data`
- **Response Structure**: `SuccessResponse<LiveTrackingData>`

### 4. Explicit Data Fetch (Request/Acknowledgement)

Use this if you need to refresh the data manually without waiting for a broadcast.

- **Event**: `queue:transport_get_live_data`
- **Payload**: `{ transportId: string }`
- **Callback**: Returns `SuccessResponse<LiveTrackingData>`

---

## Data Schema (`LiveTrackingData`)

| Field                           | Type           | Description                                         |
| :------------------------------ | :------------- | :-------------------------------------------------- |
| `animalName`                    | `string`       | Name of the animal being transported                |
| `animalBreed`                   | `string`       | Breed of the animal                                 |
| `shelterName`                   | `string`       | Receiving shelter name                              |
| `driverName`                    | `string`       | Assigned driver name                                |
| `driverConnected`               | `boolean`      | `true` if driver has pinged in the last 60 seconds  |
| `currentLatitude`               | `number`       | Latest driver Lat (falls back to Pickup if offline) |
| `currentLongitude`              | `number`       | Latest driver Lng (falls back to Pickup if offline) |
| `pickUpLatitude`                | `number`       | Origin Lat                                          |
| `pickUpLongitude`               | `number`       | Origin Lng                                          |
| `dropOffLatitude`               | `number`       | Destination Lat                                     |
| `dropOffLongitude`              | `number`       | Destination Lng                                     |
| `distanceRemaining`             | `number`       | Miles left to destination                           |
| `estimatedTimeRemainingMinutes` | `number`       | Minutes left                                        |
| `estimatedDropOffTime`          | `string (ISO)` | Predicted arrival time                              |
| `progressPercentage`            | `number`       | Trip progress (0-100)                               |
| `routePolyline`                 | `string`       | Google Maps encoded polyline for the path           |
| `milestones`                    | `Array`        | List of `{ name, eta, distance }` markers           |

---

## Interaction Flow

1. Client connects to `/queue` with token.
2. Client emits `queue:transport_join_tracking`.
3. Client listens for `queue:transport_tracking_data` to update markers/UI.
4. Client can optionally call `queue:transport_get_live_data` for manual refresh.
