import { apiRequest } from './client';

export type TrackingState = {
  should_track: boolean;
  reason?: 'no_active_job' | 'multiple_active_jobs' | string;
  job_id?: string;
  status?: string;
};

export type AvailabilityPresence = {
  visibility: 'private' | 'fleet' | 'exchange';
  available_until: string;
  recorded_at?: string;
  updated_at?: string;
};

export type AvailabilityState = {
  active: boolean;
  presence: AvailabilityPresence | null;
};

export type ReturnJourney = {
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  vehicle_type: string | null;
  notes: string | null;
};

export type ReturnJourneyInput = ReturnJourney;

export async function fetchTrackingState(token: string) {
  return apiRequest<TrackingState>('/api/driver/tracking-state', { token });
}

export async function publishJobLocation(
  token: string,
  payload: {
    job_id: string;
    lat: number;
    lng: number;
    heading?: number | null;
    speed_mph?: number | null;
  },
) {
  return apiRequest<{ ok: true; job_id: string }>('/api/driver/location', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchAvailabilityPresence(token: string) {
  return apiRequest<AvailabilityState>('/api/driver/availability-presence', { token });
}

export async function startAvailabilityPresence(
  token: string,
  payload: {
    lat: number;
    lng: number;
    visibility: 'private' | 'fleet' | 'exchange';
    hours: number;
  },
) {
  return apiRequest<{ ok: true; visibility: AvailabilityPresence['visibility']; available_until: string }>(
    '/api/driver/availability-presence',
    { method: 'POST', token, body: payload },
  );
}

export async function refreshAvailabilityPresence(token: string, lat: number, lng: number) {
  return apiRequest<{ ok: true; available_until: string }>('/api/driver/availability-presence', {
    method: 'PUT',
    token,
    body: { lat, lng },
  });
}

export async function stopAvailabilityPresence(token: string) {
  return apiRequest<{ ok: true }>('/api/driver/availability-presence', {
    method: 'DELETE',
    token,
  });
}

export async function fetchReturnJourney(token: string) {
  return apiRequest<{ journey: ReturnJourney | null }>('/api/driver/return-journey', { token });
}

export async function saveReturnJourney(token: string, journey: ReturnJourneyInput) {
  return apiRequest<{ journey: ReturnJourney | null }>('/api/driver/return-journey', {
    method: 'PUT',
    token,
    body: journey,
  });
}
