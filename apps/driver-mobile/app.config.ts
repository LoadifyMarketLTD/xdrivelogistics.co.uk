import type { ExpoConfig } from 'expo/config';

const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || undefined;

const config: ExpoConfig = {
  name: 'XDrive Driver',
  slug: 'xdrive-driver',
  owner: 'xdrive-logistics-ltd',
  version: '1.2.0',
  orientation: 'portrait',
  scheme: ['xdrivedriver', 'xdrive'],
  userInterfaceStyle: 'dark',
  newArchEnabled: false,
  icon: './assets/xdrive-native-logo.jpeg',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'co.uk.xdrivelogistics.driver',
    buildNumber: '20260905',
  },
  android: {
    package: 'co.uk.xdrivelogistics.driver',
    versionCode: 20260905,
    googleServicesFile,
    permissions: [
      'CAMERA',
      'POST_NOTIFICATIONS',
      'ACCESS_NETWORK_STATE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
    adaptiveIcon: {
      backgroundColor: '#0B2F6B',
      foregroundImage: './assets/xdrive-native-logo.jpeg',
    },
    predictiveBackGestureEnabled: false,
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
  web: {
    favicon: './assets/favicon.png',
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    releaseChannel: 'e2e-hardening',
    productionOwner: 'driver-mobile',
    eas: {
      projectId: 'c19b0bdf-567a-488e-b78f-d36b84f25c99',
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    enabled: false,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
    url: 'https://u.expo.dev/c19b0bdf-567a-488e-b78f-d36b84f25c99',
  },
};

export default config;
