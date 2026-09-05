import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiRequest } from '../api/client';
import { getInstallationId, XDRIVE_DRIVER_PACKAGE } from '../auth/deviceSession';

function nativePushTokenData(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'data' in value) {
    const nested = (value as { data?: unknown }).data;
    return typeof nested === 'string' ? nested.trim() : '';
  }
  return '';
}

/**
 * Register the provider-native Android token (FCM), not an Expo Push Token.
 * XDrive's trusted notification worker sends through FCM and reads only from
 * the server-owned driver_push_devices registry.
 */
export async function registerPushToken(sessionToken: string) {
  try {
    if (!Device.isDevice || Device.osName?.toLowerCase() !== 'android') return null;

    const existingPermission = await Notifications.getPermissionsAsync();
    const permission = existingPermission.status === 'granted'
      ? existingPermission
      : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const providerToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = nativePushTokenData(providerToken);
    if (fcmToken.length < 20) return null;

    const installationId = await getInstallationId();
    await apiRequest('/api/driver/push-devices', {
      method: 'POST',
      token: sessionToken,
      body: {
        token: fcmToken,
        installation_id: installationId,
        app_package: XDRIVE_DRIVER_PACKAGE,
      },
    });
    return fcmToken;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(sessionToken: string) {
  try {
    const installationId = await getInstallationId();
    await apiRequest('/api/driver/push-devices', {
      method: 'DELETE',
      token: sessionToken,
      body: { installation_id: installationId },
    });
  } catch {
    // Logout must still complete if push cleanup is temporarily unavailable.
  }
}
