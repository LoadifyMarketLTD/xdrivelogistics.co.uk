'use client';

import { useEffect, useMemo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type MarketplaceLoadMapItem = {
  id: string;
  pickupLabel: string;
  deliveryLabel: string;
  vehicleLabel: string;
  posterName: string;
  pickupAt: string | null;
  pickupCoordinates: { lat: number; lng: number } | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

export default function MarketplaceLoadMap({ loads }: { loads: MarketplaceLoadMapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const pins = useMemo(() => loads.filter((load) => load.pickupCoordinates), [loads]);

  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let mounted = true;

    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;

      mapRef.current?.remove();
      mapRef.current = null;
      const first = pins[0].pickupCoordinates!;
      const map = L.map(containerRef.current, {
        center: [first.lat, first.lng],
        zoom: 7,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const load of pins) {
        const coordinates = load.pickupCoordinates!;
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1d57d8;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"><div style="width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;left:6px;top:6px"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        const pickup = load.pickupAt
          ? new Date(load.pickupAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'Not set';
        L.marker([coordinates.lat, coordinates.lng], { icon }).addTo(map).bindPopup(
          `<div style="font-family:Arial,sans-serif;min-width:220px;font-size:12px"><strong>${escapeHtml(load.pickupLabel)} → ${escapeHtml(load.deliveryLabel)}</strong><br>${escapeHtml(load.vehicleLabel)}<br>${escapeHtml(load.posterName)}<br>Pickup: ${escapeHtml(pickup)}<br>Load: ${escapeHtml(load.id.slice(0, 8).toUpperCase())}</div>`,
        );
      }

      if (pins.length > 1) {
        map.fitBounds(
          L.latLngBounds(pins.map((load) => [load.pickupCoordinates!.lat, load.pickupCoordinates!.lng])),
          { padding: [28, 28] },
        );
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
    return (
      <div style={{ padding: 30, border: '1px solid #dbe2ea', background: '#f8fafc', color: '#64748b', fontSize: 12, textAlign: 'center' }}>
        No pickup points could be located for this result set. Switch to List View to review the loads.
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: 430, border: '1px solid #cbd5e1', borderRadius: 4, overflow: 'hidden' }} />;
}
