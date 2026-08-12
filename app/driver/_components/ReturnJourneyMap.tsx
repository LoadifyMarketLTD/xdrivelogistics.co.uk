'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type ReturnJourneyMapItem = {
  id: string;
  from: string;
  to: string;
  vehicleLabel: string;
  memberName: string;
  availableFrom: string | null;
  fromCoordinates: { lat: number; lng: number } | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

export default function ReturnJourneyMap({ journeys }: { journeys: ReturnJourneyMapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const pins = journeys.filter((journey) => journey.fromCoordinates);

  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let mounted = true;

    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;
      mapRef.current?.remove();
      mapRef.current = null;
      const first = pins[0].fromCoordinates!;
      const map = L.map(containerRef.current, { center: [first.lat, first.lng], zoom: 8, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const journey of pins) {
        const coordinates = journey.fromCoordinates!;
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0b2f6b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"><div style="width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;left:6px;top:6px"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        const departure = journey.availableFrom ? new Date(journey.availableFrom).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not set';
        L.marker([coordinates.lat, coordinates.lng], { icon }).addTo(map).bindPopup(
          `<div style="font-family:Arial,sans-serif;min-width:190px;font-size:12px"><strong>${escapeHtml(journey.from)} → ${escapeHtml(journey.to || 'Go Anywhere')}</strong><br>${escapeHtml(journey.vehicleLabel)}<br>${escapeHtml(journey.memberName)}<br>Departs: ${escapeHtml(departure)}</div>`,
        );
      }

      if (pins.length > 1) {
        map.fitBounds(L.latLngBounds(pins.map((journey) => [journey.fromCoordinates!.lat, journey.fromCoordinates!.lng])), { padding: [30, 30] });
      }
    };

    void initialise();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pins]);

  if (pins.length === 0) {
    return <div style={{ padding: '28px', border: '1px solid #dbe2ea', background: '#f8fafc', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>No journey start points could be located for this result set.</div>;
  }

  return <div ref={containerRef} style={{ height: 420, border: '1px solid #cbd5e1', borderRadius: 3, overflow: 'hidden' }} />;
}
