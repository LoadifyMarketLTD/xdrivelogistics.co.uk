import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderAnonKey = 'placeholder';
const extra = Constants.expoConfig?.extra ?? {};
const fallbackApiBaseUrl = 'https://www.xdrivelogistics.co.uk';

function normalizeApiBaseUrl(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) return fallbackApiBaseUrl;

  try {
    const url = new URL(normalized);
    if (url.hostname === 'xdrivelogistics.co.uk') {
      url.hostname = 'www.xdrivelogistics.co.uk';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallbackApiBaseUrl;
  }
}

function isValidSupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('supabase.co');
  } catch {
    return false;
  }
}

function isValidSupabaseAnonKey(value: string) {
  return value.length > 0 && value !== placeholderAnonKey && value !== 'placeholder-anon-key';
}

function hasValidConfig(config: SupabaseConfig | null | undefined): config is SupabaseConfig {
  if (!config) return false;
  return isValidSupabaseUrl(config.supabaseUrl) && isValidSupabaseAnonKey(config.supabaseAnonKey);
}

function bundledConfig(): SupabaseConfig | null {
  const supabaseUrl =
    (typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const supabaseAnonKey =
    (typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  return hasValidConfig({ supabaseUrl, supabaseAnonKey }) ? { supabaseUrl, supabaseAnonKey } : null;
}

function createSupabaseClient(config: SupabaseConfig | null): SupabaseClient {
  return createClient(config?.supabaseUrl || placeholderUrl, config?.supabaseAnonKey || placeholderAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

let resolvedConfig = bundledConfig();
let client = createSupabaseClient(resolvedConfig);
let runtimeConfigPromise: Promise<SupabaseConfig | null> | null = null;

export let isSupabaseConfigured = true;

async function fetchRuntimeConfig(): Promise<SupabaseConfig | null> {
  const configuredApiBaseUrl = typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl : fallbackApiBaseUrl;
  const response = await fetch(`${normalizeApiBaseUrl(configuredApiBaseUrl)}/api/driver/mobile/config`, {
    headers: {
      Accept: 'application/json',
    },
  }).catch(() => null);

  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => null)) as SupabaseConfig | null;
  if (!hasValidConfig(payload)) return null;
  return {
    supabaseUrl: payload.supabaseUrl,
    supabaseAnonKey: payload.supabaseAnonKey,
  };
}

async function ensureSupabaseClient() {
  if (hasValidConfig(resolvedConfig)) return client;

  runtimeConfigPromise ??= fetchRuntimeConfig();
  const runtimeConfig = await runtimeConfigPromise;
  if (!hasValidConfig(runtimeConfig)) {
    runtimeConfigPromise = null;
    throw new Error('Supabase mobile config is missing.');
  }

  resolvedConfig = runtimeConfig;
  client = createSupabaseClient(resolvedConfig);
  isSupabaseConfigured = true;
  return client;
}

void fetchRuntimeConfig().then((runtimeConfig) => {
  if (!hasValidConfig(runtimeConfig) || hasValidConfig(resolvedConfig)) return;
  resolvedConfig = runtimeConfig;
  client = createSupabaseClient(resolvedConfig);
  isSupabaseConfigured = true;
});

function createLazyQueryBuilder(table: string): any {
  const operations: Array<{ method: string; args: unknown[] }> = [];

  const execute = async () => {
    let builder: any = (await ensureSupabaseClient()).from(table);
    for (const operation of operations) {
      builder = builder[operation.method](...operation.args);
    }
    return builder;
  };

  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => execute().then(resolve, reject);
        if (prop === 'catch') return (reject: (reason: unknown) => unknown) => execute().catch(reject);
        if (prop === 'finally') return (onFinally: () => void) => execute().finally(onFinally);
        return (...args: unknown[]) => {
          operations.push({ method: String(prop), args });
          return proxy;
        };
      },
    }
  );

  return proxy;
}

export const supabase: any = {
  auth: {
    async getSession() {
      try {
        return await (await ensureSupabaseClient()).auth.getSession();
      } catch (error) {
        return {
          data: { session: null },
          error: error instanceof Error ? error : new Error('Supabase mobile config is missing.'),
        };
      }
    },
    async signInWithPassword(credentials: { email: string; password: string }) {
      try {
        return await (await ensureSupabaseClient()).auth.signInWithPassword(credentials);
      } catch (error) {
        return {
          data: { session: null, user: null },
          error: error instanceof Error ? error : new Error('Supabase mobile config is missing.'),
        };
      }
    },
    async signOut() {
      try {
        return await (await ensureSupabaseClient()).auth.signOut();
      } catch {
        return { error: null };
      }
    },
    async getUser() {
      try {
        return await (await ensureSupabaseClient()).auth.getUser();
      } catch (error) {
        return {
          data: { user: null },
          error: error instanceof Error ? error : new Error('Supabase mobile config is missing.'),
        };
      }
    },
    onAuthStateChange(callback: any) {
      let unsubscribe: () => void = () => undefined;
      let cancelled = false;

      void ensureSupabaseClient().then((activeClient) => {
        if (cancelled) return;
        const result = activeClient.auth.onAuthStateChange(callback);
        unsubscribe = () => result.data.subscription.unsubscribe();
      });

      return {
        data: {
          subscription: {
            unsubscribe() {
              cancelled = true;
              unsubscribe();
            },
          },
        },
      };
    },
  },
  from(table: string) {
    return createLazyQueryBuilder(table);
  },
};
