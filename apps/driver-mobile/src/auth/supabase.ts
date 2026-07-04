import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra ?? {};
// Use direct process.env access so Metro/EAS statically inlines the values at bundle time.
// Dynamic property access (e.g. via a cast variable) is NOT inlined by the Metro bundler.
const supabaseUrl = (typeof extra.supabaseUrl === 'string' && extra.supabaseUrl)
  ? extra.supabaseUrl
  : (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = (typeof extra.supabaseAnonKey === 'string' && extra.supabaseAnonKey)
  ? extra.supabaseAnonKey
  : (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
