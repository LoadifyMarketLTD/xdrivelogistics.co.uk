import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const isValidSupabaseUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('supabase.co');
  } catch {
    return false;
  }
};

const isConfigured =
  isValidSupabaseUrl(supabaseUrl) &&
  supabaseAnonKey.length > 0;

const unconfiguredFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({
      message:
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

if (!isConfigured && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable database features.'
  );
}

// Always create a client (may be non-functional if not configured)
export const supabase: SupabaseClient = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: isConfigured ? fetch : unconfiguredFetch,
    },
  }
);

export const isSupabaseConfigured = isConfigured;

export function getSupabase(): SupabaseClient | null {
  return isConfigured ? supabase : null;
}
