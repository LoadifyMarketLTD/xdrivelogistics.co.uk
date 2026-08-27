import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiRequest, getApiBaseUrl } from '../api/client';
import { ensureDeviceSession, XDRIVE_DRIVER_PACKAGE } from '../auth/deviceSession';

export async function registerPushToken(sessionToken: string) {
  try {
    if (!Device.isDevice || Device.osName?.toLowerCase() !== 'android') return null;

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof nativeToken.data === 'string' ? nativeToken.data.trim() : '';
    if (!token) return null;

    const installationId = await ensureDeviceSession(getApiBaseUrl(), sessionToken);
    await apiRequest('/api/driver/push-devices', {
      method: 'POST',
      token: sessionToken,
      body: {
        token,
        installation_id: installationId,
        app_package: XDRIVE_DRIVER_PACKAGE,
      },
    });

    return token;
  } catch {
    return null;
  }
}
