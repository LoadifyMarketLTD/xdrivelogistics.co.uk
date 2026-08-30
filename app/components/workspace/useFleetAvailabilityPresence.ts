'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';

export type FleetAvailabilityPresencePoint = {
  driverId: string;
  companyId: string;
  lat: number;
  lng: number;
  vehicleType: string | null;
  payloadKg: number | null;
  palletsCapacity: number | null;
  hasTailLift: boolean | null;
  availableUntil: string | null;
  recordedAt: string | null;
};

type NearbyPositionPayload = {
  driver_id?: unknown;
  company_id?: unknown;
  scope?: unknown;
  lat?: unknown;
  lng?: unknown;
  vehicle_type?: unknown;
  payload_kg?: unknown;
  pallets_capacity?: unknown;
  has_tail_lift?: unknown;
  available_until?: unknown;
  recorded_at?: unknown;
};

const numberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stringOrNull = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function useFleetAvailabilityPresence(companyId: string | null) {
  const [points, setPoints] = useState<FleetAvailabilityPresencePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPoints([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token?.trim();
      if (!token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/availability/nearby', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { positions?: NearbyPositionPayload[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Fleet availability positions could not be loaded.');

      const next = (payload.positions ?? []).flatMap((row): FleetAvailabilityPresencePoint[] => {
        if (row.scope !== 'fleet') return [];
        const rowCompanyId = stringOrNull(row.company_id);
        const driverId = stringOrNull(row.driver_id);
        const lat = numberOrNull(row.lat);
        const lng = numberOrNull(row.lng);
        if (!rowCompanyId || rowCompanyId !== companyId || !driverId || lat === null || lng === null) return [];
        return [{
          driverId,
          companyId: rowCompanyId,
          lat,
          lng,
          vehicleType: stringOrNull(row.vehicle_type),
          payloadKg: numberOrNull(row.payload_kg),
          palletsCapacity: numberOrNull(row.pallets_capacity),
          hasTailLift: typeof row.has_tail_lift === 'boolean' ? row.has_tail_lift : null,
          availableUntil: stringOrNull(row.available_until),
          recordedAt: stringOrNull(row.recorded_at),
        }];
      });
      setPoints(next);
    } catch (reason) {
      setPoints([]);
      setError(reason instanceof Error ? reason.message : 'Fleet availability positions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const byDriverId = useMemo(() => new Map(points.map((point) => [point.driverId, point])), [points]);

  return { points, byDriverId, loading, error, refresh };
}
