import * as Location from 'expo-location';

import {
  fetchAvailabilityPresence,
  fetchTrackingState,
  publishJobLocation,
  refreshAvailabilityPresence,
} from '../api/operations';

const RECONCILE_INTERVAL_MS = 30_000;
const JOB_PUBLISH_INTERVAL_MS = 60_000;
const AVAILABILITY_PUBLISH_INTERVAL_MS = 5 * 60_000;
const MAX_LOCATION_AGE_MS = 10 * 60_000;

type RuntimeMode = 'checking' | 'job' | 'availability' | 'stopped';

export type TrackingRuntimeSnapshot = {
  mode: RuntimeMode;
  message: string;
  jobId: string | null;
  lastPublishedAt: number | null;
};

type Listener = (snapshot: TrackingRuntimeSnapshot) => void;

let loop: ReturnType<typeof setInterval> | null = null;
let token: string | null = null;
let running = false;
let lastJobPublishAt = 0;
let lastAvailabilityPublishAt = 0;
let lastJobId: string | null = null;
let listener: Listener | null = null;
let snapshot: TrackingRuntimeSnapshot = {
  mode: 'stopped',
  message: 'Location runtime is stopped.',
  jobId: null,
  lastPublishedAt: null,
};

function emit(next: Partial<TrackingRuntimeSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listener?.(snapshot);
}

function metresPerSecondToMph(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value * 2.2369362921 : null;
}

async function currentPosition(accuracy: Location.Accuracy) {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) throw new Error('Android Location Services are switched off.');

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission is required.');

  const value = await Location.getCurrentPositionAsync({ accuracy });
  const ageMs = Date.now() - value.timestamp;
  if (ageMs > MAX_LOCATION_AGE_MS) throw new Error('The current GPS position is stale.');
  return value;
}

async function tick() {
  if (!token || !running) return;

  try {
    const state = await fetchTrackingState(token);
    if (state.should_track && state.job_id) {
      if (lastJobId !== state.job_id) {
        lastJobId = state.job_id;
        lastJobPublishAt = 0;
      }
      emit({
        mode: 'job',
        jobId: state.job_id,
        message: 'Secure job tracking is active.',
      });

      if (Date.now() - lastJobPublishAt < JOB_PUBLISH_INTERVAL_MS) return;
      const location = await currentPosition(Location.Accuracy.High);
      await publishJobLocation(token, {
        job_id: state.job_id,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        heading: Number.isFinite(location.coords.heading ?? NaN) ? location.coords.heading : null,
        speed_mph: metresPerSecondToMph(location.coords.speed),
      });
      lastJobPublishAt = Date.now();
      emit({ lastPublishedAt: lastJobPublishAt, message: 'Secure job location shared.' });
      return;
    }

    lastJobId = null;
    lastJobPublishAt = 0;

    const availability = await fetchAvailabilityPresence(token);
    if (!availability.active) {
      emit({ mode: 'checking', jobId: null, message: 'No active job or availability sharing.' });
      return;
    }

    emit({ mode: 'availability', jobId: null, message: 'Availability sharing is active.' });
    if (Date.now() - lastAvailabilityPublishAt < AVAILABILITY_PUBLISH_INTERVAL_MS) return;

    const location = await currentPosition(Location.Accuracy.Balanced);
    await refreshAvailabilityPresence(token, location.coords.latitude, location.coords.longitude);
    lastAvailabilityPublishAt = Date.now();
    emit({ lastPublishedAt: lastAvailabilityPublishAt, message: 'Availability location refreshed.' });
  } catch (error) {
    emit({ message: error instanceof Error ? error.message : 'Location runtime will retry.' });
  }
}

export function getTrackingRuntimeSnapshot() {
  return snapshot;
}

export function subscribeTrackingRuntime(nextListener: Listener) {
  listener = nextListener;
  nextListener(snapshot);
  return () => {
    if (listener === nextListener) listener = null;
  };
}

export function startTrackingRuntime(sessionToken: string) {
  token = sessionToken.trim();
  if (!token) return;
  running = true;
  emit({ mode: 'checking', message: 'Checking current driver work state.' });
  if (!loop) loop = setInterval(() => void tick(), RECONCILE_INTERVAL_MS);
  void tick();
}

export function stopTrackingRuntime() {
  running = false;
  token = null;
  lastJobPublishAt = 0;
  lastAvailabilityPublishAt = 0;
  lastJobId = null;
  if (loop) clearInterval(loop);
  loop = null;
  emit({ mode: 'stopped', jobId: null, lastPublishedAt: null, message: 'Location runtime is stopped.' });
}
