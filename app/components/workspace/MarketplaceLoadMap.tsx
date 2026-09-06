'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './MarketplaceLoadMap.css';

import { ActionButton } from './WorkspaceUI';

export type MarketplaceLoadMapItem = {
  id: string;
  pickupLabel: string;
  pickupPostcode?: string | null;
  deliveryLabel: string;
  deliveryPostcode?: string | null;
  vehicleLabel: string;
  posterName: string;
  pickupAt: string | null;
  postedAt?: string | null;
  /** Legacy field is accepted but intentionally ignored pre-award. */
  pickupCoordinates?: { lat: number; lng: number } | null;
};

type Coordinates = { lat: number; lng: number };
type LocatedLoad = MarketplaceLoadMapItem & { coordinates: Coordinates; deliveryCoordinates: Coordinates | null };
type RadarCluster = { key: string; coordinates: Coordinates; loads: LocatedLoad[] };

const normalizeOutcode = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0] ?? '';

const validCoordinates = (lat: unknown, lng: unknown): Coordinates | null => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
};

const ageMinutes = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 60_000) : Number.POSITIVE_INFINITY;
};

const markerTone = (loads: LocatedLoad[]) => {
  const freshest = Math.min(...loads.map((load) => ageMinutes(load.postedAt)));
  return freshest <= 10
    ? { stroke: '#1D57D8', fill: '#3B82F6' }
    : { stroke: '#5B21B6', fill: '#7C3AED' };
};

const when = (value: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Not set';

const publicOutcodeFor = (load: MarketplaceLoadMapItem) => normalizeOutcode(load.pickupPostcode) || normalizeOutcode(load.pickupLabel);
const publicDeliveryOutcodeFor = (load: MarketplaceLoadMapItem) => normalizeOutcode(load.deliveryPostcode) || normalizeOutcode(load.deliveryLabel);
const midpoint = (from: Coordinates, to: Coordinates): Coordinates => ({ lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 });
const routeBearing = (from: Coordinates, to: Coordinates) => Math.atan2(to.lng - from.lng, to.lat - from.lat) * (180 / Math.PI);

export default function MarketplaceLoadMap({
  loads,
  onQuote,
  onDetails,
}: {
  loads: MarketplaceLoadMapItem[];
  onQuote?: (loadId: string) => void;
  onDetails?: (loadId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const [coordinateByOutcode, setCoordinateByOutcode] = useState<Record<string, Coordinates>>({});
  const [locating, setLocating] = useState(false);
  const [providerWarning, setProviderWarning] = useState('');
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);

  const outcodes = useMemo(
    () => [...new Set(loads.flatMap((load) => [publicOutcodeFor(load), publicDeliveryOutcodeFor(load)]).filter(Boolean))],
    [loads],
  );

  useEffect(() => {
    let cancelled = false;
    const unresolved = outcodes.filter((outcode) => !coordinateByOutcode[outcode]);
    if (!unresolved.length) return;

    const locate = async () => {
      setLocating(true);
      const resolved: Record<string, Coordinates> = {};
      let failures = 0;
      await Promise.all(unresolved.slice(0, 120).map(async (outcode) => {
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
        ? 'Public pickup areas could not be located. List View remains fully available.'
        : '');
      setLocating(false);
    };

    void locate();
    return () => { cancelled = true; };
  }, [coordinateByOutcode, outcodes]);

  const locatedLoads = useMemo<LocatedLoad[]>(() => loads.flatMap((load) => {
    const coordinates = coordinateByOutcode[publicOutcodeFor(load)];
    const deliveryCoordinates = coordinateByOutcode[publicDeliveryOutcodeFor(load)] ?? null;
    return coordinates ? [{ ...load, coordinates, deliveryCoordinates }] : [];
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

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.key === selectedClusterKey) ?? null,
    [clusters, selectedClusterKey],
  );

  useEffect(() => {
    if (!selectedClusterKey) return;
    if (!clusters.some((cluster) => cluster.key === selectedClusterKey)) setSelectedClusterKey(null);
  }, [clusters, selectedClusterKey]);

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

      for (const load of locatedLoads) {
        if (!load.deliveryCoordinates) continue;
        const from = load.coordinates;
        const to = load.deliveryCoordinates;
        const route = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
          color: '#64748b',
          weight: 2,
          opacity: 0.55,
          dashArray: '6 5',
          interactive: true,
        }).addTo(map);
        route.bindTooltip(`${load.pickupLabel} → ${load.deliveryLabel}`);
        const centre = midpoint(from, to);
        const bearing = routeBearing(from, to);
        L.marker([centre.lat, centre.lng], {
          interactive: false,
          icon: L.divIcon({
            className: 'marketplace-radar-direction-icon',
            html: `<span style="transform:rotate(${bearing.toFixed(1)}deg)">➤</span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(map);
      }

      for (const cluster of clusters) {
        const tone = markerTone(cluster.loads);
        const radius = cluster.loads.length === 1 ? 8 : Math.min(19, 9 + Math.log2(cluster.loads.length + 1) * 3);
        const marker = L.circleMarker([cluster.coordinates.lat, cluster.coordinates.lng], {
          radius,
          color: tone.stroke,
          fillColor: tone.fill,
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        marker.bindTooltip(cluster.loads.length === 1
          ? `${cluster.loads[0].pickupLabel} → ${cluster.loads[0].deliveryLabel}`
          : `${cluster.loads.length} loads in this public pickup area`);
        marker.on('click', () => setSelectedClusterKey(cluster.key));
      }

      const boundsCoordinates = locatedLoads.flatMap((load) => [
        [load.coordinates.lat, load.coordinates.lng] as [number, number],
        ...(load.deliveryCoordinates ? [[load.deliveryCoordinates.lat, load.deliveryCoordinates.lng] as [number, number]] : []),
      ]);
      if (boundsCoordinates.length > 1) {
        map.fitBounds(L.latLngBounds(boundsCoordinates), {
          padding: [28, 28],
          maxZoom: 11,
        });
      }
    };

    void initialise();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [clusters, locatedLoads]);

  if (locating && clusters.length === 0) {
    return <div className="marketplace-radar-empty" role="status">Locating public pickup areas for Freight Radar…</div>;
  }

  if (clusters.length === 0) {
    return <div className="marketplace-radar-empty" role="status">{providerWarning || 'No public pickup areas could be mapped for this result set. Switch to List View to review the loads.'}</div>;
  }

  return (
    <div className="marketplace-radar-shell">
      <div className="marketplace-radar-legend" aria-label="Freight Radar legend">
        <span><i data-tone="fresh" /> Posted within ~10 minutes</span>
        <span><i data-tone="older" /> Older load</span>
        <span>Cluster = multiple loads in one public pickup area</span>
        <span>Dashed arrow = pickup → delivery direction using public outcodes</span>
      </div>
      {providerWarning && <div className="marketplace-radar-warning" role="status">{providerWarning}</div>}
      <div ref={containerRef} className="marketplace-radar-map" aria-label="Interactive Freight Radar Map" />

      {selectedCluster && (
        <section className="marketplace-radar-cluster" aria-label={`${selectedCluster.loads.length} loads in selected area`}>
          <header>
            <strong>{selectedCluster.loads.length} load{selectedCluster.loads.length === 1 ? '' : 's'} in this area</strong>
            <button type="button" onClick={() => setSelectedClusterKey(null)} aria-label="Close selected area">×</button>
          </header>
          <div className="marketplace-radar-cluster__list">
            {selectedCluster.loads.slice(0, 12).map((load) => (
              <div key={load.id} className="marketplace-radar-cluster__row">
                <span>
                  <strong>{load.pickupLabel} → {load.deliveryLabel}</strong>
                  <small>{load.vehicleLabel} · {load.posterName} · Pickup {when(load.pickupAt)}</small>
                </span>
                <span className="marketplace-radar-cluster__actions">
                  {onDetails && <ActionButton tone="secondary" onClick={() => onDetails(load.id)}>Details</ActionButton>}
                  {onQuote && <ActionButton tone="success" onClick={() => onQuote(load.id)}>Quote Now</ActionButton>}
                </span>
              </div>
            ))}
            {selectedCluster.loads.length > 12 && <div className="marketplace-radar-cluster__more">+ {selectedCluster.loads.length - 12} more loads in this area — refine the search or use List View.</div>}
          </div>
        </section>
      )}

      <div className="marketplace-radar-privacy">Pre-award radar routes use public pickup and delivery postcode/outcode centroids only. Exact collection/delivery coordinates and private execution details remain protected until authorised award/allocation.</div>
    </div>
  );
}
