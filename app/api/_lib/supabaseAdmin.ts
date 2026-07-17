import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  '';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.SUPABASE_SERVICE_KEY?.trim()) {
  console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set — admin operations are disabled.');
} else if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim()) {
  console.warn('[supabaseAdmin] Using legacy SUPABASE_SERVICE_KEY — prefer SUPABASE_SERVICE_ROLE_KEY.');
}

// Anon key (public) — used for JWT validation so that token verification never
// depends on the service-role key being present/correct.  The service-role key
// is only needed for privileged admin operations (inviteUserByEmail, etc.).
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceKey);

const clientOpts = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, clientOpts)
  : null;

// Validator client uses the publicly-known anon key so that auth.getUser(jwt)
// always works even when the service-role key is misconfigured or absent in
// non-production environments (e.g. Netlify deploy previews).
export const supabaseValidator =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, clientOpts)
    : supabaseAdmin;

export const getBearerToken = (request: NextRequest) => {
  const authHeader = request.headers.get('authorization') ?? '';
  const [scheme, ...rest] = authHeader.split(' ');
  const token = rest.join(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
};
