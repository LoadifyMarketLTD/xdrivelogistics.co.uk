import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest } from '../api/client';

function easProjectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const configured = typeof extra?.eas?.projectId === 'string' ? extra.eas.projectId.trim() : '';
  const runtime = typeof Constants.easConfig?.projectId === 'string' ? Constants.easConfig.projectId.trim() : '';
  return configured || runtime || null;
}

export async function registerPushToken(sessionToken: string) {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'XDrive Driver',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const projectId = easProjectId();
    if (!projectId) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
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
