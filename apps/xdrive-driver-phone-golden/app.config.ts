import type { ExpoConfig } from 'expo/config';

function normalizeSupabaseUrl(value: string | undefined) {
  let normalized = value?.trim() ?? '';
  while (/^https?:\/\/https?:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^https?:\/\/https?:\/\//i, 'https://');
  }
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return '';
    return url.origin;
  } catch {
    return '';
  }
}

const config: ExpoConfig = {
  name: 'XDrive Driver',
  slug: 'xdrive-driver',
  owner: 'xdrive-logistics-ltd',
  version: '1.0.0',
  icon: './assets/icon.png',
  orientation: 'portrait',
  scheme: 'xdrivedriver',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'co.uk.xdrivelogistics.driver',
  },
  android: {
    package: 'co.uk.xdrivelogistics.driver',
    versionCode: 1,
    icon: './assets/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#07111F',
    },
    permissions: [
      'CAMERA',
      'POST_NOTIFICATIONS',
      'ACCESS_NETWORK_STATE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
    blockedPermissions: ['READ_PHONE_STATE', 'READ_CALL_LOG', 'WRITE_CALL_LOG', 'RECORD_AUDIO'],
    intentFilters: [
      {
        action: 'VIEW',
        data: [
          {
            scheme: 'https',
            host: '*.xdrivelogistics.co.uk',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-asset',
    'expo-secure-store',
    'expo-image-picker',
    'expo-document-picker',
    'expo-notifications',
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.xdrivelogistics.co.uk',
    supabaseUrl: normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
    eas: {
      projectId: 'c19b0bdf-567a-488e-b78f-d36b84f25c99',
    },
  },
};

export default config;
