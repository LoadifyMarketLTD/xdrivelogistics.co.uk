import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'XDrive Driver',
  slug: 'xdrive-driver',
  owner: 'xdrive-logistics-ltd',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'xdrivedriver',
  userInterfaceStyle: 'dark',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'co.uk.xdrivelogistics.driver',
  },
  android: {
    package: 'co.uk.xdrivelogistics.driver',
    permissions: ['CAMERA', 'POST_NOTIFICATIONS', 'ACCESS_NETWORK_STATE'],
  },
  plugins: ['expo-asset', 'expo-secure-store', 'expo-image-picker', 'expo-document-picker', 'expo-notifications'],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://xdrivelogistics.co.uk',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    eas: {
      projectId: 'c19b0bdf-567a-488e-b78f-d36b84f25c99',
    },
  },
};

export default config;
