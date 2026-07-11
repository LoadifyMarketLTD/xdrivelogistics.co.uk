import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiRequest } from '../api/client';

export async function registerPushToken(sessionToken: string) {
  try {
    if (!Device.isDevice) return null;
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const projectId: string | undefined =
      typeof Constants.expoConfig?.extra?.eas?.projectId === 'string'
        ? Constants.expoConfig.extra.eas.projectId
        : undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiRequest('/api/driver/mobile/device-token', {
      method: 'POST',
      token: sessionToken,
      body: { token: token.data, platform: Device.osName },
    });
    return token.data;
  } catch {
    return null;
  }
}
