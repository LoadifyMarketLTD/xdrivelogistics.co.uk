import 'react-native-url-polyfill/auto';

import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

import { getChunkedSecureItem, removeChunkedSecureItem, setChunkedSecureItem } from './chunkedSecureStore';

function normalizeSupabaseUrl(value: unknown) {
  let normalized = typeof value === 'string' ? value.trim() : '';
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

function normalizeAnonKey(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized || normalized === 'placeholder' || normalized === 'placeholder-anon-key') return '';
  return normalized;
}

const secureAuthStorage = {
  getItem: getChunkedSecureItem,
  setItem: setChunkedSecureItem,
  removeItem: removeChunkedSecureItem,
};

// Metro/EAS statically inlines EXPO_PUBLIC_* variables at bundle time.
// Validate both Expo extra values and the directly inlined env values so a
// malformed build-time URL cannot silently produce a generic network failure.
const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = normalizeSupabaseUrl(
  typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : process.env.EXPO_PUBLIC_SUPABASE_URL,
);
const supabaseAnonKey = normalizeAnonKey(
  typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const mobileAuthConfigurationError = isSupabaseConfigured
  ? null
  : 'XDrive Driver authentication is not configured correctly for this build.';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
