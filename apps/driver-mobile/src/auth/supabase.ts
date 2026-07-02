import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra ?? {};
const env: Partial<Record<'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY', string>> =
  typeof process !== 'undefined'
    ? (process.env as unknown as Partial<Record<'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY', string>>)
    : {};
const supabaseUrl = typeof extra.supabaseUrl === 'string' && extra.supabaseUrl
  ? extra.supabaseUrl
  : env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = typeof extra.supabaseAnonKey === 'string' && extra.supabaseAnonKey
  ? extra.supabaseAnonKey
  : env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
