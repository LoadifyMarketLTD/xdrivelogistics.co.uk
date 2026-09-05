import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { ApiRequestError, apiRequest } from '../api/client';
import { fetchJobs } from '../api/jobs';
import { getSessionToken } from '../auth/sessionStore';
import { supabase } from '../auth/supabase';

export const DRIVER_LOCATION_TASK = 'xdrive-driver-live-location';

const TRACKING_JOB_KEY = 'xdrive.driver.trackingJobId';
const TRACKING_DIAGNOSTIC_KEY = 'xdrive.driver.trackingDiagnostic';
const RECONCILE_INTERVAL_MS = 60_000;
const LOCATION_INTERVAL_MS = 60_000;
const LOCATION_DISTANCE_METRES = 25;

let coordinatorStarted = false;
let coordinatorInterval: ReturnType<typeof setInterval> | null = null;
let authSubscription: { unsubscribe(): void } | null = null;
let foregroundWatch: Location.LocationSubscription | null = null;
let reconcileInFlight: Promise<void> | null = null;

const TRACKABLE_STATUSES = new Set([
  'accepted',
  'on_my_way',
  'on_my_way_pickup',
  'on_site_pickup',
  'arrived_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_delivery',
  'on_route_delivery',
  'on_site_delivery',
  'arrived_delivery',
]);

function statusCandidates(job: Record<string, unknown>) {
  return [job.currentStatus, job.lifecycleStatus, job.status]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function selectTrackingJobId(jobs: Array<Record<string, unknown>>) {
  const trackable = jobs.filter((job) => statusCandidates(job).some((status) => TRACKABLE_STATUSES.has(status)));
  return trackable.length === 1 && typeof trackable[0]?.id === 'string' ? trackable[0].id : null;
}

function metresPerSecondToMph(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 2.2369362921 * 10) / 10;
}

function normalizedHeading(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value % 360;
}

async function readFreshSessionToken() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (token) return token;
  } catch {
    // Fall back to the SecureStore mirror maintained by DriverMobileApp.
  }
  const stored = await getSessionToken().catch(() => null);
  return stored?.trim() || null;
}

async function writeDiagnostic(message: string) {
  await AsyncStorage.setItem(
    TRACKING_DIAGNOSTIC_KEY,
    JSON.stringify({ message, at: new Date().toISOString() }),
  ).catch(() => undefined);
}

async function stopBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => undefined);
}

function stopForegroundTracking() {
  foregroundWatch?.remove();
  foregroundWatch = null;
}

async function stopAllTracking(reason: string) {
  stopForegroundTracking();
  await stopBackgroundTracking();
  await AsyncStorage.removeItem(TRACKING_JOB_KEY).catch(() => undefined);
  await writeDiagnostic(`stopped:${reason}`);
}

async function publishLocation(location: Location.LocationObject) {
  const token = await readFreshSessionToken();
  if (!token) {
    await stopAllTracking('no-session');
    return;
  }

  const jobId = (await AsyncStorage.getItem(TRACKING_JOB_KEY).catch(() => null))?.trim() || null;
  if (!jobId) {
    await stopAllTracking('no-active-job');
    return;
  }

  const coords = location.coords;
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;

  try {
    await apiRequest('/api/driver/location', {
      method: 'POST',
      token,
      body: {
        job_id: jobId,
        lat: coords.latitude,
        lng: coords.longitude,
        heading: normalizedHeading(coords.heading),
        speed_mph: metresPerSecondToMph(coords.speed),
      },
    });
    await writeDiagnostic('publish:ok');
  } catch (error) {
    if (error instanceof ApiRequestError && [401, 403, 409].includes(error.status)) {
      await stopAllTracking(`server-${error.status}`);
      return;
    }
    await writeDiagnostic(`publish:transient:${error instanceof Error ? error.message : 'unknown'}`);
  }
}

TaskManager.defineTask(
  DRIVER_LOCATION_TASK,
  async ({ data, error }: { data?: { locations?: Location.LocationObject[] } | null; error?: Error | null }) => {
    if (error) {
      await writeDiagnostic(`task-error:${error.message}`);
      return;
    }
    const locations = Array.isArray(data?.locations) ? data.locations : [];
    const latest = locations[locations.length - 1];
    if (latest) await publishLocation(latest);
  },
);

async function ensurePermissions() {
  if (!(await Location.hasServicesEnabledAsync().catch(() => false))) return { foreground: false, background: false };

  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { foreground: false, background: false };

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted' && background.canAskAgain !== false) {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  return { foreground: true, background: background.status === 'granted' };
}

async function startForegroundFallback() {
  if (foregroundWatch) return;
  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL_MS,
      distanceInterval: LOCATION_DISTANCE_METRES,
    },
    (location) => {
      void publishLocation(location);
    },
  );
  await writeDiagnostic('tracking:foreground');
}

async function startBackgroundTracking() {
  stopForegroundTracking();
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  if (started) return;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_INTERVAL_MS,
    distanceInterval: LOCATION_DISTANCE_METRES,
    deferredUpdatesInterval: LOCATION_INTERVAL_MS,
    deferredUpdatesDistance: LOCATION_DISTANCE_METRES,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'XDrive Driver tracking active',
      notificationBody: 'Live location is shared only while you are completing an assigned job.',
      notificationColor: '#0B2F6B',
    },
  });
  await writeDiagnostic('tracking:background');
}

export async function reconcileDriverLocationTracking() {
  if (reconcileInFlight) return reconcileInFlight;

  reconcileInFlight = (async () => {
    const token = await readFreshSessionToken();
    if (!token) {
      await stopAllTracking('signed-out');
      return;
    }

    let jobs: Array<Record<string, unknown>> = [];
    try {
      const response = await fetchJobs('active', token);
      jobs = Array.isArray(response.jobs) ? response.jobs as unknown as Array<Record<string, unknown>> : [];
    } catch (error) {
      await writeDiagnostic(`reconcile:jobs:${error instanceof Error ? error.message : 'unknown'}`);
      return;
    }

    const jobId = selectTrackingJobId(jobs);
    if (!jobId) {
      await stopAllTracking(jobs.length > 0 ? 'ambiguous-or-pre-execution' : 'no-active-job');
      return;
    }

    await AsyncStorage.setItem(TRACKING_JOB_KEY, jobId);
    const permissions = await ensurePermissions();
    if (!permissions.foreground) {
      await stopAllTracking('foreground-permission-denied');
      return;
    }

    if (permissions.background) await startBackgroundTracking();
    else await startForegroundFallback();
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}

export function startDriverLocationCoordinator() {
  if (coordinatorStarted) return () => undefined;
  coordinatorStarted = true;

  void reconcileDriverLocationTracking();
  coordinatorInterval = setInterval(() => {
    void reconcileDriverLocationTracking();
  }, RECONCILE_INTERVAL_MS);

  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
    void reconcileDriverLocationTracking();
  });
  authSubscription = subscription;

  return () => {
    coordinatorStarted = false;
    if (coordinatorInterval) clearInterval(coordinatorInterval);
    coordinatorInterval = null;
    authSubscription?.unsubscribe();
    authSubscription = null;
    stopForegroundTracking();
  };
}
