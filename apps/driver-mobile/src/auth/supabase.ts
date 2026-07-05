import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Metro/EAS statically inlines EXPO_PUBLIC_* variables at bundle time.
// Using direct property access (not a variable) is required for Metro to inline them.
const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl =
  (typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey =
  (typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
