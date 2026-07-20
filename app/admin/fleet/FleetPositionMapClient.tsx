'use client';

import { useEffect, useMemo } from 'react';
import { LatLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';

export type FleetMapPoint = {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  jobId?: string | null;
  timestamp?: string | null;
  stale: boolean;
};

function MapViewport({ points, selectedDriverId }: { points: FleetMapPoint[]; selectedDriverId: string | null }) {
  const map = useMap();

  useEffect(() => {
    const selected = selectedDriverId
      ? points.find((point) => point.driverId === selectedDriverId)
      : null;

    if (selected) {
      map.setView([selected.lat, selected.lng], 12, { animate: true });
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }

    if (points.length > 1) {
      const bounds = new LatLngBounds(points.map((point) => [point.lat, point.lng]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    }
  }, [map, points, selectedDriverId]);

  return null;
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'No timestamp';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Invalid timestamp'
    : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function FleetPositionMapClient({
  points,
  selectedDriverId,
}: {
  points: FleetMapPoint[];
  selectedDriverId: string | null;
}) {
  const validPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points]
  );
  const selected = selectedDriverId
    ? validPoints.find((point) => point.driverId === selectedDriverId)
    : null;
  const centre: [number, number] = selected
    ? [selected.lat, selected.lng]
    : validPoints.length > 0
      ? [validPoints[0].lat, validPoints[0].lng]
      : [54.5, -3.0];

  return (
    <div style={{ height: '440px', width: '100%', overflow: 'hidden', borderRadius: '9px' }}>
      <MapContainer
        center={centre}
        zoom={validPoints.length > 0 ? 8 : 5}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={validPoints} selectedDriverId={selectedDriverId} />
        {validPoints.map((point) => (
          <CircleMarker
            key={point.driverId}
            center={[point.lat, point.lng]}
            radius={point.driverId === selectedDriverId ? 11 : 8}
            pathOptions={{
              color: point.stale ? '#b91c1c' : '#166534',
              fillColor: point.stale ? '#ef4444' : '#22c55e',
              fillOpacity: 0.86,
              weight: point.driverId === selectedDriverId ? 4 : 2,
            }}
          >
            <Popup>
              <strong>{point.driverName}</strong>
              <br />
              {point.stale ? 'Location is stale' : 'Live location'}
              <br />
              Updated: {formatTimestamp(point.timestamp)}
              <br />
              Job: {point.jobId ? point.jobId.slice(0, 8).toUpperCase() : 'Not linked'}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
