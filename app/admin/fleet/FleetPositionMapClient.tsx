'use client';

import { useEffect, useMemo, useState } from 'react';
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

export type FleetMapMode = 'live' | 'future';

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

const hasValidCoordinates = (point: FleetMapPoint) =>
  Number.isFinite(point.lat)
  && Number.isFinite(point.lng)
  && point.lat >= -90
  && point.lat <= 90
  && point.lng >= -180
  && point.lng <= 180;

export default function FleetPositionMapClient({
  points,
  selectedDriverId,
  mode = 'live',
}: {
  points: FleetMapPoint[];
  selectedDriverId: string | null;
  mode?: FleetMapMode;
}) {
  const [providerError, setProviderError] = useState(false);
  const validPoints = useMemo(() => points.filter(hasValidCoordinates), [points]);

  useEffect(() => {
    setProviderError(false);
  }, [validPoints]);

  const selected = selectedDriverId
    ? validPoints.find((point) => point.driverId === selectedDriverId)
    : null;
  const centre: [number, number] = selected
    ? [selected.lat, selected.lng]
    : [validPoints[0]?.lat ?? 54.5, validPoints[0]?.lng ?? -3.0];

  if (validPoints.length === 0) {
    return (
      <div
        style={{
          height: '440px',
          width: '100%',
          overflow: 'hidden',
          borderRadius: '9px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#64748b',
          fontSize: '0.9rem',
        }}
        data-testid="fleet-map-no-coords"
        role="status"
        aria-live="polite"
      >
        {mode === 'future' ? 'No geocoded future fleet positions available.' : 'No live fleet positions available.'}
      </div>
    );
  }

  return (
    <div
      data-testid="fleet-map-ready"
      style={{
        position: 'relative',
        height: '440px',
        width: '100%',
        overflow: 'hidden',
        borderRadius: '9px',
        background: '#e2e8f0',
      }}
    >
      {providerError && (
        <div
          data-testid="fleet-map-provider-error"
          role="alert"
          aria-live="assertive"
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 1000,
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            background: 'rgba(255, 251, 235, 0.96)',
            color: '#92400e',
            padding: '10px 12px',
            fontSize: '0.86rem',
            lineHeight: 1.4,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.14)',
          }}
        >
          Map tiles are temporarily unavailable. {mode === 'future' ? 'Future positions' : 'Driver positions'} could not be displayed on the base map.
        </div>
      )}

      <MapContainer
        center={centre}
        zoom={8}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setProviderError(true),
            tileload: () => setProviderError(false),
          }}
        />
        <MapViewport points={validPoints} selectedDriverId={selectedDriverId} />
        {validPoints.map((point) => (
          <CircleMarker
            key={point.driverId}
            center={[point.lat, point.lng]}
            radius={point.driverId === selectedDriverId ? 11 : 8}
            pathOptions={{
              color: mode === 'future' ? '#1d4ed8' : point.stale ? '#b91c1c' : '#166534',
              fillColor: mode === 'future' ? '#3b82f6' : point.stale ? '#ef4444' : '#22c55e',
              fillOpacity: 0.86,
              weight: point.driverId === selectedDriverId ? 4 : 2,
            }}
          >
            <Popup>
              <strong>{point.driverName}</strong>
              <br />
              {mode === 'future' ? 'Future declared position' : point.stale ? 'Location is stale' : 'Live location'}
              <br />
              {mode === 'future' ? 'Available from' : 'Updated'}: {formatTimestamp(point.timestamp)}
              <br />
              {mode === 'future' ? 'Next job' : 'Job'}: {point.jobId ? point.jobId.slice(0, 8).toUpperCase() : 'Not linked'}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
