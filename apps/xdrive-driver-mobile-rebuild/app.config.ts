import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'XDrive Driver Preview',
  slug: 'xdrive-driver-rebuild',
  owner: 'xdrive-logistics-ltd',
  version: '1.0.0',
  orientation: 'portrait',
  newArchEnabled: false,
  icon: './assets/icon.png',
  scheme: 'xdrivedriver-preview',
  userInterfaceStyle: 'light',
  android: {
    package: 'co.uk.xdrivelogistics.driver.preview',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    permissions: ['CAMERA', 'POST_NOTIFICATIONS', 'ACCESS_NETWORK_STATE']
  },
  plugins: ['expo-secure-store', 'expo-asset', 'expo-document-picker'],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://deploy-preview-510--xdrivelogistics.netlify.app',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://jqxlauexhkonixtjvljw.supabase.co',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_yxmGBfB7tzCgBXi_6T-uJQ_JNNYmBVO',
    eas: { projectId: 'c19b0bdf-567a-488e-b78f-d36b84f25c99' }
  }
};

export default config;
