import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import { apiRequest } from '../api/client';

type NativeLocationPoint = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speedMph?: number | null;
  accuracyMetres?: number | null;
  recordedAtMs?: number | null;
};

type NativeLocationModule = {
  getCurrentPosition: () => Promise<NativeLocationPoint>;
};

type ActiveJobProjection = {
  id?: string;
  status?: string;
};

const TRACKABLE_MOBILE_STATES = new Set([
  'on_my_way_pickup',
  'arrived_pickup',
  'loaded',
  'on_my_way_delivery',
  'arrived_delivery',
]);

const nativeLocation = NativeModules.XDriveLocation as NativeLocationModule | undefined;

export type DriverTrackingState = 'standby' | 'starting' | 'active' | 'permission-required' | 'unavailable';

export async function publishCurrentDriverLocation(token: string) {
  if (Platform.OS !== 'android' || !nativeLocation?.getCurrentPosition) {
    throw new Error('Native driver location is unavailable in this build.');
  }

  // Server-confirmed execution must exist before XDrive asks Android for GPS.
  // Awarded/upcoming work is intentionally excluded from tracking.
  const active = await apiRequest<{ jobs?: ActiveJobProjection[] }>('/api/driver/mobile/jobs?scope=active', { token });
  const executingJob = (active.jobs ?? []).find((job) =>
    typeof job.id === 'string' && job.id.trim() && TRACKABLE_MOBILE_STATES.has(String(job.status ?? '').trim().toLowerCase()),
  );
  if (!executingJob?.id) {
    throw new Error('No active booking requires tracking.');
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  const granted = alreadyGranted
    ? PermissionsAndroid.RESULTS.GRANTED
    : await PermissionsAndroid.request(permission, {
        title: 'Allow XDrive Driver to use your location',
        message: 'Location is shared with XDrive only while you have an active booking that requires live tracking.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Location permission is required for active-job tracking.');
  }

  const point = await nativeLocation.getCurrentPosition();
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    throw new Error('The device returned an invalid location.');
  }

  await apiRequest('/api/driver/location', {
    method: 'POST',
    token,
    body: {
      job_id: executingJob.id,
      lat: point.latitude,
      lng: point.longitude,
      heading: typeof point.heading === 'number' && Number.isFinite(point.heading) ? point.heading : null,
      speed_mph: typeof point.speedMph === 'number' && Number.isFinite(point.speedMph) ? point.speedMph : null,
    },
  });

  return point;
}

export function classifyTrackingError(error: unknown): DriverTrackingState {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('no active booking') || message.includes('tracking is allowed only')) return 'standby';
  if (message.includes('permission')) return 'permission-required';
  return 'unavailable';
}
