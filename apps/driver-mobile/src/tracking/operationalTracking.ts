import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, Platform } from 'react-native';

import { fetchTrackingState, publishJobLocation } from '../api/operations';
import { getSessionToken } from '../auth/sessionStore';

export const OPERATIONAL_TRACKING_TASK = 'xdrive-driver-operational-location';

const TRACKING_INTERVAL_MS = 20_000;
const TRACKING_DISTANCE_METRES = 50;
let permissionPromptInFlight = false;
let backgroundPermissionPromptAttempted = false;

function speedMetresPerSecondToMph(speed: number | null | undefined) {
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed * 2.2369362921 : null;
}

function latestLocation(data: unknown): Location.LocationObject | null {
  if (!data || typeof data !== 'object') return null;
  const locations = (data as { locations?: unknown }).locations;
  if (!Array.isArray(locations) || locations.length === 0) return null;
  const candidate = locations[locations.length - 1];
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as Location.LocationObject;
}

TaskManager.defineTask(OPERATIONAL_TRACKING_TASK, async ({ data, error }) => {
  if (error) return;

  const location = latestLocation(data);
  if (!location) return;

  const token = (await getSessionToken().catch(() => null))?.trim() || '';
  if (!token) {
    await Location.stopLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK).catch(() => undefined);
    return;
  }

  try {
    // The server is the authority on whether tracking is allowed at this moment.
    const trackingState = await fetchTrackingState(token);
    if (!trackingState.should_track || !trackingState.job_id) {
      await Location.stopLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK).catch(() => undefined);
      return;
    }

    const { latitude, longitude, heading, speed } = location.coords;
    await publishJobLocation(token, {
      job_id: trackingState.job_id,
      lat: latitude,
      lng: longitude,
      heading: typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 ? heading : null,
      speed_mph: speedMetresPerSecondToMph(speed),
    });
  } catch {
    // A transient network/server failure must not fabricate tracking state.
    // The next native location event will retry against the server authority.
  }
});

async function requestBackgroundPermissionWithExplanation(): Promise<boolean> {
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === Location.PermissionStatus.GRANTED) return true;
  if (permissionPromptInFlight || backgroundPermissionPromptAttempted) return false;

  permissionPromptInFlight = true;
  backgroundPermissionPromptAttempted = true;
  try {
    if (Platform.OS === 'android') {
      const accepted = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        Alert.alert(
          'Location during active jobs',
          'XDrive Driver uses background location only while an assigned delivery job is active so authorised operations users can follow job progress and delivery ETA.',
          [
            { text: 'Not now', style: 'cancel', onPress: () => finish(false) },
            { text: 'Continue', onPress: () => finish(true) },
          ],
          { cancelable: true, onDismiss: () => finish(false) },
        );
      });
      if (!accepted) return false;
    }

    const requested = await Location.requestBackgroundPermissionsAsync();
    return requested.status === Location.PermissionStatus.GRANTED;
  } finally {
    permissionPromptInFlight = false;
  }
}

export async function stopOperationalTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK).catch(() => undefined);
}

export async function syncOperationalTracking(options: { promptForPermissions?: boolean } = {}): Promise<
  'started' | 'already_started' | 'stopped' | 'no_session' | 'permission_required'
> {
  const token = (await getSessionToken().catch(() => null))?.trim() || '';
  if (!token) {
    await stopOperationalTracking();
    return 'no_session';
  }

  const trackingState = await fetchTrackingState(token);
  if (!trackingState.should_track || !trackingState.job_id) {
    await stopOperationalTracking();
    return 'stopped';
  }

  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    if (!options.promptForPermissions) return 'permission_required';
    foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) return 'permission_required';
  }

  let backgroundGranted = (await Location.getBackgroundPermissionsAsync()).status === Location.PermissionStatus.GRANTED;
  if (!backgroundGranted && options.promptForPermissions) {
    backgroundGranted = await requestBackgroundPermissionWithExplanation();
  }
  if (!backgroundGranted) return 'permission_required';

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK).catch(() => false);
  if (alreadyStarted) return 'already_started';

  await Location.startLocationUpdatesAsync(OPERATIONAL_TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: TRACKING_INTERVAL_MS,
    distanceInterval: TRACKING_DISTANCE_METRES,
    deferredUpdatesInterval: TRACKING_INTERVAL_MS,
    deferredUpdatesDistance: TRACKING_DISTANCE_METRES,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'XDrive Driver — active job tracking',
      notificationBody: 'Location sharing is active for your current delivery job.',
      killServiceOnDestroy: false,
    },
  });

  return 'started';
}
