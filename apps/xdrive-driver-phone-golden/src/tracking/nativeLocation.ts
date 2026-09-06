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

const nativeLocation = NativeModules.XDriveLocation as NativeLocationModule | undefined;

export type DriverTrackingState = 'standby' | 'starting' | 'active' | 'permission-required' | 'unavailable';

export async function publishCurrentDriverLocation(token: string) {
  if (Platform.OS !== 'android' || !nativeLocation?.getCurrentPosition) {
    throw new Error('Native driver location is unavailable in this build.');
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
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
      lat: point.latitude,
      lng: point.longitude,
      heading: Number.isFinite(point.heading) ? point.heading : null,
      speed_mph: Number.isFinite(point.speedMph) ? point.speedMph : null,
    },
  });

  return point;
}

export function classifyTrackingError(error: unknown): DriverTrackingState {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('permission')) return 'permission-required';
  return 'unavailable';
}
