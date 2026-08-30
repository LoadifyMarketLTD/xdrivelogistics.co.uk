'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

type RadarLoad = {
  id: string;
  pickupLabel: string;
  pickupPostcode: string | null;
  deliveryLabel: string;
  vehicleLabel: string;
  posterName: string;
  pickupAt: string | null;
  postedAt: string | null;
};

type Coordinates = { lat: number; lng: number };

type LocatedLoad = RadarLoad & { coordinates: Coordinates };

type RadarCluster = {
  key: string;
  coordinates: Coordinates;
  loads: LocatedLoad[];
};

const normalizeOutcode = (value: string | null) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');

const validCoordinates = (lat: unknown, lng: unknown): Coordinates | null => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : null;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] ?? character));

const ageMinutes = (value: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 60_000) : Number.POSITIVE_INFINITY;
};

const markerTone = (loads: LocatedLoad[]) => {
  const freshest = Math.min(...loads.map((load) => ageMinutes(load.postedAt)));
  if (freshest <= 10) return { stroke: '#1D57D8', fill: '#3B82F6' };
  return { stroke: '#5B21B6', fill: '#7C3AED' };
};

export default function DriverMarketplaceRadarMap({ loads }: { loads: RadarLoad[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const [coordinateByOutcode, setCoordinateByOutcode] = useState<Record<string, Coordinates>>({});
  const [locating, setLocating] = useState(false);
  const [providerWarning, setProviderWarning] = useState('');

  const outcodes = useMemo(
    () => [...new Set(loads.map((load) => normalizeOutcode(load.pickupPostcode)).filter(Boolean))],
    [loads],
  );

  useEffect(() => {
    let cancelled = false;
    const unresolved = outcodes.filter((outcode) => !coordinateByOutcode[outcode]);
    if (unresolved.length === 0) return;

    const locate = async () => {
      setLocating(true);
      const resolved: Record<string, Coordinates> = {};
      let failures = 0;
      await Promise.all(unresolved.slice(0, 60).map(async (outcode) => {
        try {
          const response = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`);
          if (!response.ok) { failures += 1; return; }
          const payload = await response.json() as { result?: { latitude?: number; longitude?: number } | null };
          const coordinates = validCoordinates(payload.result?.latitude, payload.result?.longitude);
          if (coordinates) resolved[outcode] = coordinates;
          else failures += 1;
        } catch {
          failures += 1;
        }
      }));
      if (cancelled) return;
      setCoordinateByOutcode((current) => ({ ...current, ...resolved }));
      setProviderWarning(failures && Object.keys(resolved).length === 0
        ? 'Map locations could not be resolved. List View remains fully available.'
        : '');
      setLocating(false);
    };

    void locate();
    return () => { cancelled = true; };
  }, [coordinateByOutcode, outcodes]);

  const locatedLoads = useMemo<LocatedLoad[]>(() => loads.flatMap((load) => {
    const coordinates = coordinateByOutcode[normalizeOutcode(load.pickupPostcode)];
    return coordinates ? [{ ...load, coordinates }] : [];
  }), [coordinateByOutcode, loads]);

  const clusters = useMemo<RadarCluster[]>(() => {
    const grouped = new Map<string, RadarCluster>();
    for (const load of locatedLoads) {
      const key = `${load.coordinates.lat.toFixed(3)}:${load.coordinates.lng.toFixed(3)}`;
      const current = grouped.get(key);
      if (current) current.loads.push(load);
      else grouped.set(key, { key, coordinates: load.coordinates, loads: [load] });
    }
    return [...grouped.values()];
  }, [locatedLoads]);

  useEffect(() => {
    if (!containerRef.current || clusters.length === 0) return;
    let mounted = true;

    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;

      mapRef.current?.remove();
      const first = clusters[0].coordinates;
      const map = L.map(containerRef.current, { center: [first.lat, first.lng], zoom: 7, scrollWheelZoom: true });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const cluster of clusters) {
        const tone = markerTone(cluster.loads);
        const radius = cluster.loads.length === 1 ? 8 : Math.min(18, 9 + Math.log2(cluster.loads.length + 1) * 3);
        const marker = L.circleMarker([cluster.coordinates.lat, cluster.coordinates.lng], {
          radius,
          color: tone.stroke,
          fillColor: tone.fill,
          fillOpacity: 0.88,
          weight: 2,
        }).addTo(map);

        const items = cluster.loads.slice(0, 8).map((load) => {
          const pickup = load.pickupAt
            ? new Date(load.pickupAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Not set';
          return `<div style="padding:6px 0;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(load.pickupLabel)} → ${escapeHtml(load.deliveryLabel)}</strong><br>${escapeHtml(load.vehicleLabel)} · ${escapeHtml(load.posterName)}<br>Pickup: ${escapeHtml(pickup)}<br><a href="/driver/loads/${encodeURIComponent(load.id)}" style="color:#1D57D8;font-weight:700">Open / quote</a></div>`;
        }).join('');
        const extra = cluster.loads.length > 8 ? `<div style="padding-top:6px;color:#64748b">+ ${cluster.loads.length - 8} more loads in this area</div>` : '';
        marker.bindPopup(`<div style="min-width:260px;font-family:Arial,sans-serif;font-size:12px"><strong>${cluster.loads.length} load${cluster.loads.length === 1 ? '' : 's'} in this area</strong>${items}${extra}</div>`, { maxHeight: 320 });
      }

      if (clusters.length > 1) {
        map.fitBounds(L.latLngBounds(clusters.map((cluster) => [cluster.coordinates.lat, cluster.coordinates.lng])), { padding: [28, 28], maxZoom: 11 });
      }
    };

    void initialise();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [clusters]);

  if (locating && clusters.length === 0) {
    return <div className="driver-radar-empty" role="status">Locating public pickup areas for Freight Radar…</div>;
  }

  if (clusters.length === 0) {
    return <div className="driver-radar-empty" role="status">{providerWarning || 'No public pickup areas could be mapped for this result set. Switch to List View to review the loads.'}</div>;
  }

  return (
    <div className="driver-radar-shell">
      <div className="driver-radar-legend" aria-label="Freight Radar legend">
        <span><i data-tone="fresh" /> Posted within ~10 minutes</span>
        <span><i data-tone="older" /> Older load</span>
        <span>Numbered marker = multiple loads in the same public pickup area</span>
      </div>
      {providerWarning && <div className="driver-radar-warning" role="status">{providerWarning}</div>}
      <div ref={containerRef} className="driver-radar-map" aria-label="Interactive Freight Radar Map" />
      <div className="driver-radar-privacy">Pre-award map positions use public postcode/outcode centroids only. Exact collection coordinates remain protected until authorised award/allocation.</div>
    </div>
  );
}
