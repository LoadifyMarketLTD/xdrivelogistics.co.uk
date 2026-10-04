'use client';

import { useEffect, useMemo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type DriverNearbyMapPoint = {
  companyId: string | null;
  memberName: string;
  memberCode: string | null;
  lat: number;
  lng: number;
  vehicleType: string | null;
  payloadKg: number | null;
  palletsCapacity: number | null;
  recordedAt: string | null;
};

const isValidPoint = (point: DriverNearbyMapPoint) =>
  Number.isFinite(point.lat)
  && Number.isFinite(point.lng)
  && point.lat >= -90
  && point.lat <= 90
  && point.lng >= -180
  && point.lng <= 180;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[character] ?? character));

const vehicleLabel = (value: string | null) => value
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Vehicle not published';

const timestampLabel = (value: string | null) => {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Timestamp unavailable'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function DriverNearbyMap({ points }: { points: DriverNearbyMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const validPoints = useMemo(() => points.filter(isValidPoint), [points]);

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;

      mapRef.current?.remove();

      const map = L.map(containerRef.current, {
        center: [54.5, -3.0],
        zoom: 6,
        minZoom: 4,
        maxZoom: 18,
        scrollWheelZoom: true,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const coordinates: [number, number][] = [];
      for (const point of validPoints) {
        coordinates.push([point.lat, point.lng]);

        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 8,
          color: '#0B2F6B',
          fillColor: '#1D57D8',
          fillOpacity: 0.88,
          weight: 2,
        }).addTo(map);

        const capacity = [
          point.payloadKg != null ? `${point.payloadKg} kg` : null,
          point.palletsCapacity != null ? `${point.palletsCapacity} pallets` : null,
        ].filter(Boolean).join(' · ');

        marker.bindPopup(`
          <div style="min-width:220px;font:12px/1.45 Arial,sans-serif;color:#263548">
            <strong>${escapeHtml(point.memberName)}</strong><br>
            ${point.memberCode ? `Member ID ${escapeHtml(point.memberCode)}<br>` : ''}
            ${escapeHtml(vehicleLabel(point.vehicleType))}${capacity ? ` · ${escapeHtml(capacity)}` : ''}<br>
            <span style="color:#64748b">Privacy-rounded exchange area</span><br>
            <span style="color:#64748b">Updated ${escapeHtml(timestampLabel(point.recordedAt))}</span>
          </div>
        `);
      }

      if (coordinates.length === 1) {
        map.setView(coordinates[0], 10);
      } else if (coordinates.length > 1) {
        map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32], maxZoom: 11 });
      }

      window.setTimeout(() => map.invalidateSize(), 0);
    };

    void initialise();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [validPoints]);

  return (
    <div
      ref={containerRef}
      data-testid="driver-nearby-real-map"
      aria-label="Nearby exchange availability map"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
