import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client for browser usage
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client-side Supabase client
// This is safe to use in the browser - uses anon key with RLS
export const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { 
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export default supabaseClient

/**
 * Create a server-side Supabase client with service role key
 * 
 * WARNING: This uses the SERVICE_ROLE_KEY which bypasses Row Level Security (RLS).
 * NEVER expose this client or the SERVICE_ROLE_KEY to the client-side.
 * Only use in API routes and server components.
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient} Server Supabase client
 */
export function createServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server client')
  }

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
