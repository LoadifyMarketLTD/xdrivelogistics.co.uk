'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthHeader } from '../../lib/routeAuthCookie';
import 'leaflet/dist/leaflet.css';

type Point = { lat: number; lng: number };
type Route = { geometry?: { type: string; coordinates: number[][] }; distanceMiles?: number; durationMinutes?: number };
const postcodePath = (value: string | null) => {
  const normalized = (value || '').toUpperCase().replace(/\s/g, '');
  const full = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normalized);
  const outward = normalized.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0];
  return full ? 'postcodes/' + normalized : outward ? 'outcodes/' + outward : null;
};
async function geocode(value: string | null, signal: AbortSignal): Promise<Point | null> {
  const path = postcodePath(value);
  if (!path) return null;
  const response = await fetch('https://api.postcodes.io/' + path, { signal });
  if (!response.ok) return null;
  const json = await response.json() as { result?: { latitude?: number; longitude?: number } };
  const { latitude, longitude } = json.result || {};
  return typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null;
}
const formatLeg = (route: Route | null) => route && Number.isFinite(route.distanceMiles) && Number.isFinite(route.durationMinutes)
  ? `${route.distanceMiles} miles · ${route.durationMinutes} mins` : 'Distance unavailable';
export default function LoadRoutePreview({ pickup, delivery, loadId }: { pickup: string | null; delivery: string | null; loadId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [pickupLeg, setPickupLeg] = useState<Route | null>(null);
  const [jobLeg, setJobLeg] = useState<Route | null>(null);
  const [notice, setNotice] = useState('');
  const [driverLocated, setDriverLocated] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let map: import('leaflet').Map | null = null;
    let alive = true;
    const init = async () => {
      try {
        const [L, a, b] = await Promise.all([import('leaflet'), geocode(pickup, controller.signal), geocode(delivery, controller.signal)]);
        if (!alive || !host.current) return;
        if (!a || !b) { setNotice('Map unavailable for these public postcode areas.'); return; }
        map = L.map(host.current, { scrollWheelZoom: false, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
        const bounds = L.latLngBounds([[a.lat, a.lng], [b.lat, b.lng]]);
        const collection = L.circleMarker([a.lat, a.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 }).addTo(map);
        collection.bindPopup('Collection · ' + (pickup || 'Public area'));
        const destination = L.circleMarker([b.lat, b.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#e04d48', fillOpacity: 1 }).addTo(map);
        destination.bindPopup('Delivery · ' + (delivery || 'Public area'));
        map.fitBounds(bounds, { padding: [34, 34], maxZoom: 11 });
        const authorization = await readRouteAuthHeader();
        const route = async (start: Point, end: Point): Promise<Route | null> => {
          if (!authorization) return null;
          try {
            const q = new URLSearchParams({ aLat: String(start.lat), aLng: String(start.lng), bLat: String(end.lat), bLng: String(end.lng) });
            const response = await fetch('/api/driver/web/public-route?' + q, { headers: { Authorization: authorization }, signal: controller.signal });
            return response.ok ? await response.json() as Route : null;
          } catch { return null; }
        };
        const job = await route(a, b);
        if (!alive || !map) return;
        setJobLeg(job);
        const coordinates = job?.geometry?.type === 'LineString' ? job.geometry.coordinates : [];
        if (coordinates && coordinates.length > 1) {
          const line = L.polyline(coordinates.map(p => [p[1], p[0]] as [number, number]), { color: '#1D57D8', weight: 5, opacity: 0.95 }).addTo(map);
          bounds.extend(line.getBounds());
        } else {
          setNotice('Road route unavailable. Showing approximate pickup and delivery areas.');
        }
        // GPS is optional and requires the driver's explicit browser permission.
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(async position => {
            if (!alive || !map) return;
            const current = { lat: position.coords.latitude, lng: position.coords.longitude };
            L.circleMarker([current.lat, current.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#0B2F6B', fillOpacity: 1 }).bindPopup('Your current location').addTo(map);
            bounds.extend([current.lat, current.lng]);
            map.fitBounds(bounds, { padding: [34, 34], maxZoom: 11 });
            setDriverLocated(true);
            const toPickup = await route(current, a);
            if (!alive || !map) return;
            setPickupLeg(toPickup);
            if (toPickup?.geometry?.type === 'LineString' && toPickup.geometry.coordinates.length > 1) {
              L.polyline(toPickup.geometry.coordinates.map(p => [p[1], p[0]] as [number, number]), { color: '#F5A300', weight: 4, opacity: 0.9 }).addTo(map);
            }
          }, () => { if (alive) setNotice('Location permission unavailable. Job route remains visible.'); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
        }
        window.setTimeout(() => { if (alive) map?.invalidateSize(); }, 120);
      } catch { if (alive) setNotice('Map temporarily unavailable.'); }
    };
    void init();
    return () => { alive = false; controller.abort(); map?.remove(); };
  }, [pickup, delivery]);
  return <section className="xd-route-preview" aria-label="Load route preview">
    <div className="xd-route-map" ref={host} aria-label="Interactive map of public collection and delivery areas" />
    <div className="xd-route-summary">
      <div><strong>To collection</strong><span>{driverLocated ? formatLeg(pickupLeg) : 'Allow location to calculate'}</span></div>
      <div><strong>Job distance</strong><span>{formatLeg(jobLeg)}</span></div>
      <Link href={'/driver-pwa-fresh/jobs?view=map&load=' + encodeURIComponent(loadId)}>View on Map</Link>
    </div>
    {notice ? <p className="xd-route-notice" role="status">{notice}</p> : null}
  </section>;
}
