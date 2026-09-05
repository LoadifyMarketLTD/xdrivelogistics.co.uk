'use client';

import { useEffect, useRef } from 'react';

export type OperationalDriverPin = {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline';
  vehicle: { registration: string; label: string } | null;
  location: { lat: number | null; lng: number | null; heading: number | null; speed_mph: number | null; recorded_at: string | null } | null;
};

export type OperationalJobPin = {
  id: string;
  short_id: string;
  client: string;
  status: string;
  pickup: string;
  delivery: string;
  eta: { eta_at: string | null; remaining_minutes: number | null; late_by_minutes: number | null } | null;
  map: { pickup_lat: number | null; pickup_lng: number | null; delivery_lat: number | null; delivery_lng: number | null };
};

const DRIVER_COLORS = { online: '#16A34A', busy: '#F5A300', offline: '#DC2626' } as const;
const JOB_COLOR = '#1D57D8';

function driverOperationalColor(pin: OperationalDriverPin) {
  if (pin.status === 'offline') return DRIVER_COLORS.offline;
  if ((pin.location?.speed_mph ?? 0) > 3) return DRIVER_COLORS.online;
  return pin.status === 'busy' ? DRIVER_COLORS.busy : '#D9A400';
}

export default function SuperAdminOperationalMap({ drivers, jobs, routes }: {
  drivers: OperationalDriverPin[];
  jobs: OperationalJobPin[];
  routes: OperationalJobPin[];
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!nodeRef.current) return;
    let mounted = true;

    const render = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !nodeRef.current) return;
      mapRef.current?.remove();

      const validDrivers = drivers.filter((pin) => Number.isFinite(pin.location?.lat) && Number.isFinite(pin.location?.lng));
      const points: Array<[number, number]> = validDrivers.map((pin) => [Number(pin.location!.lat), Number(pin.location!.lng)]);
      for (const job of jobs) {
        if (Number.isFinite(job.map.pickup_lat) && Number.isFinite(job.map.pickup_lng)) points.push([Number(job.map.pickup_lat), Number(job.map.pickup_lng)]);
        if (Number.isFinite(job.map.delivery_lat) && Number.isFinite(job.map.delivery_lng)) points.push([Number(job.map.delivery_lat), Number(job.map.delivery_lng)]);
      }

      const map = L.map(nodeRef.current, { center: [52.6, -1.5], zoom: 6, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = (color: string, label: string) => L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(11,47,107,.28);display:grid;place-items:center;color:#fff;font:800 10px/1 Inter,sans-serif">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const popup = (title: string, lines: string[]) => {
        const root = document.createElement('div');
        root.style.minWidth = '170px';
        root.style.fontFamily = 'Inter, sans-serif';
        const heading = document.createElement('strong');
        heading.textContent = title;
        heading.style.color = '#0B2F6B';
        root.appendChild(heading);
        for (const line of lines) {
          const item = document.createElement('div');
          item.textContent = line;
          item.style.fontSize = '11px';
          item.style.marginTop = '4px';
          item.style.color = '#475569';
          root.appendChild(item);
        }
        return root;
      };

      for (const pin of validDrivers) {
        const moving = (pin.location?.speed_mph ?? 0) > 3;
        const state = pin.status === 'offline' ? 'Offline' : moving ? 'Moving' : 'Idle';
        const lines = [
          `${state}${pin.location?.speed_mph != null ? ` · ${Math.round(pin.location.speed_mph)} mph` : ''}`,
          pin.vehicle ? `${pin.vehicle.registration} · ${pin.vehicle.label}` : 'No assigned vehicle',
          pin.location?.recorded_at ? `Last fix: ${new Date(pin.location.recorded_at).toLocaleString('en-GB')}` : 'Last fix unavailable',
        ];
        L.marker([Number(pin.location!.lat), Number(pin.location!.lng)], { icon: markerIcon(driverOperationalColor(pin), 'V') })
          .addTo(map)
          .bindPopup(popup(pin.name, lines));
      }

      for (const job of jobs) {
        const eta = job.eta?.eta_at ? `ETA ${new Date(job.eta.eta_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'ETA unavailable';
        if (Number.isFinite(job.map.pickup_lat) && Number.isFinite(job.map.pickup_lng)) {
          L.marker([Number(job.map.pickup_lat), Number(job.map.pickup_lng)], { icon: markerIcon(JOB_COLOR, 'J') })
            .addTo(map)
            .bindPopup(popup(`Job ${job.short_id}`, [job.client, `Pickup: ${job.pickup}`, eta]));
        }
      }

      for (const job of routes) {
        const a: [number, number] = [Number(job.map.pickup_lat), Number(job.map.pickup_lng)];
        const b: [number, number] = [Number(job.map.delivery_lat), Number(job.map.delivery_lng)];
        if (![...a, ...b].every(Number.isFinite)) continue;
        L.polyline([a, b], { color: JOB_COLOR, weight: 3, opacity: 0.75, dashArray: '8 6' }).addTo(map);
      }

      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [34, 34], maxZoom: 11 });
      else if (points.length === 1) map.setView(points[0], 10);

      const regions = [
        { label: 'London', lat: 51.5074, lng: -0.1278, zoom: 9 },
        { label: 'Midlands', lat: 52.4862, lng: -1.8904, zoom: 8 },
        { label: 'North', lat: 53.8008, lng: -1.5491, zoom: 7 },
        { label: 'UK', lat: 54.1, lng: -2.4, zoom: 6 },
      ];
      const control = new L.Control({ position: 'topright' });
      control.onAdd = () => {
        const wrap = L.DomUtil.create('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '4px';
        wrap.style.background = '#fff';
        wrap.style.padding = '5px';
        wrap.style.border = '1px solid #D9E1EA';
        wrap.style.borderRadius = '8px';
        L.DomEvent.disableClickPropagation(wrap);
        for (const region of regions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = region.label;
          button.style.border = '1px solid #D9E1EA';
          button.style.background = '#fff';
          button.style.color = '#0B2F6B';
          button.style.borderRadius = '6px';
          button.style.padding = '5px 7px';
          button.style.fontSize = '10px';
          button.style.fontWeight = '800';
          button.onclick = () => map.setView([region.lat, region.lng], region.zoom);
          wrap.appendChild(button);
        }
        return wrap;
      };
      control.addTo(map);
    };

    void render();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [drivers, jobs, routes]);

  return <div ref={nodeRef} aria-label="Live operational map" style={{ width: '100%', minHeight: 390, border: '1px solid #D9E1EA', borderRadius: 8, overflow: 'hidden', background: '#E8EEF5' }} />;
}
