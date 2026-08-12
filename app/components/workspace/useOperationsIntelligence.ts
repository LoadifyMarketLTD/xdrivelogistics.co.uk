'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';

export type OperationsCapabilityState = 'available' | 'unavailable';

export type OperationsFuturePosition = {
  id: string;
  futurePosition: string | null;
  futurePositionDate: string | null;
  coordinates: { lat: number; lng: number } | null;
};

export type OperationsVehicleAdvertising = {
  id: string;
  assignedDriverId: string | null;
  advertisingState: string;
};

export type OperationsReturnJourney = {
  id: string;
  driverId: string | null;
  fromPostcode: string | null;
  toPostcode: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  status: string | null;
  createdAt: string | null;
  fromCoordinates: { lat: number; lng: number } | null;
};

export type OperationsJobDetail = {
  id: string | null;
  assignedDriverId: string | null;
  status: string | null;
  pickupTimeSlot: string | null;
  deliveryTimeSlot: string | null;
  pickupDateTime: string | null;
  deliveryDateTime: string | null;
  collectionContactName: string | null;
  collectionContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  clientName: string | null;
  clientPhone: string | null;
};

export type OperationsTrackingEvent = {
  id: string | null;
  jobId: string | null;
  eventType: string;
  message: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
};

type IntelligenceResponse = {
  futurePositions?: OperationsFuturePosition[];
  vehicleAdvertising?: OperationsVehicleAdvertising[];
  returnJourneys?: OperationsReturnJourney[];
  jobDetails?: OperationsJobDetail[];
  trackingEvents?: OperationsTrackingEvent[];
  capabilities?: Record<string, OperationsCapabilityState>;
  partial?: boolean;
  generatedAt?: string;
  error?: string;
  referenceId?: string;
};

export type OperationsIntelligenceState = {
  loading: boolean;
  error: string;
  partial: boolean;
  generatedAt: string | null;
  futurePositions: OperationsFuturePosition[];
  vehicleAdvertising: OperationsVehicleAdvertising[];
  returnJourneys: OperationsReturnJourney[];
  jobDetails: OperationsJobDetail[];
  trackingEvents: OperationsTrackingEvent[];
  capabilities: Record<string, OperationsCapabilityState>;
  futureByDriver: Map<string, OperationsFuturePosition>;
  advertisingByVehicle: Map<string, string>;
  journeyByDriver: Map<string, OperationsReturnJourney>;
  jobDetailById: Map<string, OperationsJobDetail>;
  eventsByJob: Map<string, OperationsTrackingEvent[]>;
  refresh: () => Promise<void>;
};

const initialCapabilities: Record<string, OperationsCapabilityState> = {
  futurePositions: 'available',
  vehicleAdvertising: 'available',
  returnJourneys: 'available',
  jobDetails: 'available',
  trackingTimeline: 'available',
};

export function useOperationsIntelligence(companyId: string | null): OperationsIntelligenceState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [futurePositions, setFuturePositions] = useState<OperationsFuturePosition[]>([]);
  const [vehicleAdvertising, setVehicleAdvertising] = useState<OperationsVehicleAdvertising[]>([]);
  const [returnJourneys, setReturnJourneys] = useState<OperationsReturnJourney[]>([]);
  const [jobDetails, setJobDetails] = useState<OperationsJobDetail[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<OperationsTrackingEvent[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, OperationsCapabilityState>>(initialCapabilities);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setFuturePositions([]);
      setVehicleAdvertising([]);
      setReturnJourneys([]);
      setJobDetails([]);
      setTrackingEvents([]);
      setGeneratedAt(null);
      setPartial(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setLoading(false);
      setError('Your session has expired. Sign in again.');
      return;
    }

    try {
      const response = await fetch(`/api/workspace/operations-intelligence?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as IntelligenceResponse;
      if (!response.ok) {
        const message = payload.error ?? 'Operations intelligence could not be loaded.';
        setError(payload.referenceId ? `${message} Reference: ${payload.referenceId}` : message);
        return;
      }

      setFuturePositions(payload.futurePositions ?? []);
      setVehicleAdvertising(payload.vehicleAdvertising ?? []);
      setReturnJourneys(payload.returnJourneys ?? []);
      setJobDetails(payload.jobDetails ?? []);
      setTrackingEvents(payload.trackingEvents ?? []);
      setCapabilities({ ...initialCapabilities, ...(payload.capabilities ?? {}) });
      setPartial(Boolean(payload.partial));
      setGeneratedAt(payload.generatedAt ?? null);
    } catch {
      setError('Operations intelligence could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const futureByDriver = useMemo(() => new Map(futurePositions.map((row) => [row.id, row])), [futurePositions]);
  const advertisingByVehicle = useMemo(() => new Map(vehicleAdvertising.map((row) => [row.id, row.advertisingState])), [vehicleAdvertising]);
  const journeyByDriver = useMemo(() => {
    const map = new Map<string, OperationsReturnJourney>();
    for (const journey of returnJourneys) {
      if (!journey.driverId || map.has(journey.driverId)) continue;
      map.set(journey.driverId, journey);
    }
    return map;
  }, [returnJourneys]);
  const jobDetailById = useMemo(() => new Map(jobDetails.flatMap((row) => row.id ? [[row.id, row] as const] : [])), [jobDetails]);
  const eventsByJob = useMemo(() => {
    const map = new Map<string, OperationsTrackingEvent[]>();
    for (const event of trackingEvents) {
      if (!event.jobId) continue;
      const list = map.get(event.jobId) ?? [];
      list.push(event);
      map.set(event.jobId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    }
    return map;
  }, [trackingEvents]);

  return {
    loading,
    error,
    partial,
    generatedAt,
    futurePositions,
    vehicleAdvertising,
    returnJourneys,
    jobDetails,
    trackingEvents,
    capabilities,
    futureByDriver,
    advertisingByVehicle,
    journeyByDriver,
    jobDetailById,
    eventsByJob,
    refresh,
  };
}
