'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export type DriverFreightVisionPoint = {
  jobId: string;
  label: string;
  lat: number;
  lng: number;
  recordedAt: string | null;
  fresh: boolean;
};

const valid = (point: DriverFreightVisionPoint) =>
  Number.isFinite(point.lat)
  && Number.isFinite(point.lng)
  && point.lat >= -90
  && point.lat <= 90
  && point.lng >= -180
  && point.lng <= 180;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] ?? character));

const when = (value: string | null) => {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function DriverFreightVisionMap({ points }: { points: DriverFreightVisionPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const [providerWarning, setProviderWarning] = useState('');
  const validPoints = useMemo(() => points.filter(valid), [points]);

  useEffect(() => {
    let mounted = true;
    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;
      mapRef.current?.remove();
      setProviderWarning('');

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
      })
        .on('tileerror', () => mounted && setProviderWarning('Map tiles are temporarily unavailable. Job tracking data remains available in the list.'))
        .on('tileload', () => mounted && setProviderWarning(''))
        .addTo(map);

      const coordinates: [number, number][] = [];
      for (const point of validPoints) {
        coordinates.push([point.lat, point.lng]);
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 9,
          color: point.fresh ? '#166534' : '#b91c1c',
          fillColor: point.fresh ? '#22c55e' : '#ef4444',
          fillOpacity: 0.88,
          weight: 2,
        }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:220px;font:12px/1.45 Arial,sans-serif;color:#263548">
            <strong>${escapeHtml(point.label)}</strong><br>
            Job ${escapeHtml(point.jobId.slice(0, 8).toUpperCase())}<br>
            <span style="color:#64748b">${point.fresh ? 'Fresh tracking position' : 'Tracking position is stale'}</span><br>
            <span style="color:#64748b">Updated ${escapeHtml(when(point.recordedAt))}</span>
          </div>
        `);
      }

      if (coordinates.length === 1) map.setView(coordinates[0], 11);
      else if (coordinates.length > 1) map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32], maxZoom: 11 });
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
    <div className="driver-freight-map-shell" data-testid="driver-freight-vision-real-map">
      <div ref={containerRef} className="driver-freight-map-canvas" aria-label="Freight Vision live tracking map" />
      {validPoints.length === 0 && <div className="driver-freight-map-empty" role="status">No approved live tracking position is available for the jobs in this view.</div>}
      {providerWarning && <div className="driver-freight-map-warning" role="alert">{providerWarning}</div>}
    </div>
  );
}
