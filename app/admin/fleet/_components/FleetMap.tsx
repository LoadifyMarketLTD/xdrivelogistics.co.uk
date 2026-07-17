'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface FleetPin {
  driverId: string;
  driverName: string;
  vehicleReg: string;
  vehicleType: string;
  availabilityStatus: 'available' | 'busy' | 'offline' | null;
  lat: number;
  lng: number;
  trackedAt: string;
}

interface FleetMapProps {
  pins: FleetPin[];
  style?: React.CSSProperties;
}

const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  busy:      '#d97706',
  offline:   '#dc2626',
};

// Leaflet is loaded dynamically to avoid SSR issues
export default function FleetMap({ pins, style }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    const init = async () => {
      const L = (await import('leaflet')).default;

      // Leaflet CSS is imported at module level — no runtime injection needed.

      if (!isMounted || !containerRef.current) return;

      // Destroy previous map instance on re-render
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const defaultCenter: [number, number] = pins.length > 0
        ? [pins[0].lat, pins[0].lng]
        : [51.505, -0.09]; // London fallback

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 10,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      pins.forEach((pin) => {
        const color = STATUS_COLOR[pin.availabilityStatus ?? 'offline'] ?? '#64748b';
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22s14-12.37 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>
        `;
        const icon = L.divIcon({
          html: svg,
          className: '',
          iconSize: [28, 36],
          iconAnchor: [14, 36],
          popupAnchor: [0, -36],
        });

        const popup = `
          <div style="font-family:sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${pin.vehicleReg || 'Unknown'}</div>
            <div style="font-size:0.8rem;color:#374151">${pin.vehicleType.replace(/_/g, ' ')}</div>
            <div style="font-size:0.8rem;color:#374151;margin-top:4px">
              <strong>Driver:</strong> ${pin.driverName}
            </div>
            <div style="font-size:0.75rem;color:#6b7280;margin-top:2px">
              Last seen: ${new Date(pin.trackedAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
            </div>
          </div>
        `;

        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(popup);
      });

      // Fit bounds if multiple pins
      if (pins.length > 1) {
        const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    };

    init().catch(() => {/* map load failure is non-fatal */});

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pins]);

  if (pins.length === 0) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          color: '#94a3b8',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        📍 No tracked vehicles right now
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}
    />
  );
}
