'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type LiveAvailabilityMapItem = {
  key: string;
  lat: number;
  lng: number;
  memberName: string;
  memberCode: string | null;
  vehicleLabel: string;
  recordedAt: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

export default function LiveAvailabilityMap({ positions }: { positions: LiveAvailabilityMapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || positions.length === 0) return;
    let mounted = true;

    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;

      mapRef.current?.remove();
      mapRef.current = null;
      const first = positions[0];
      const map = L.map(containerRef.current, { center: [first.lat, first.lng], zoom: 8, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const position of positions) {
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0b2f6b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"><div style="width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;left:6px;top:6px"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        const received = position.recordedAt
          ? new Date(position.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'Not supplied';
        L.marker([position.lat, position.lng], { icon }).addTo(map).bindPopup(
          '<div style="font-family:Arial,sans-serif;min-width:180px;font-size:12px"><strong>' +
          escapeHtml(position.memberName) +
          '</strong><br>' +
          escapeHtml(position.memberCode ?? 'Member ID unavailable') +
          '<br>' +
          escapeHtml(position.vehicleLabel) +
          '<br>Location received: ' +
          escapeHtml(received) +
          '</div>',
        );
      }

      if (positions.length > 1) {
        map.fitBounds(L.latLngBounds(positions.map((position) => [position.lat, position.lng])), { padding: [30, 30] });
      }
    };

    void initialise();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [positions]);

  if (positions.length === 0) {
    return <div className="xd2-calm-empty"><b>No map positions</b><span>No exchange-visible location is available for these filters.</span></div>;
  }

  return <div ref={containerRef} style={{ height: '100%', minHeight: 420, border: '1px solid #cbd5e1', overflow: 'hidden' }} />;
}
