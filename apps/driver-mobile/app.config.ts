import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'XDrive Driver Preview',
  slug: 'xdrive-driver-preview',
  owner: 'xdrive-logistics-ltd',
  version: '1.1.0-preview.2',
  orientation: 'portrait',
  scheme: 'xdrivedriverpreview',
  userInterfaceStyle: 'dark',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'co.uk.xdrivelogistics.driver.preview',
  },
  android: {
    package: 'co.uk.xdrivelogistics.driver.preview',
    permissions: [
      'CAMERA',
      'POST_NOTIFICATIONS',
      'ACCESS_NETWORK_STATE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    releaseChannel: 'preview',
    productionOwner: 'android-native',
    eas: {
      projectId: 'c19b0bdf-567a-488e-b78f-d36b84f25c99',
    },
  },
};

export default config;
