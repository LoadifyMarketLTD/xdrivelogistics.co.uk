import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Client-side Supabase client (for browser usage with anon key)
// Fallback to placeholder if env vars not set (for build time)
export const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { 
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

// Server-side Supabase client (for API routes with service role key)
// NOTE: SUPABASE_SERVICE_ROLE_KEY is a server-only environment variable
// It should NEVER be prefixed with NEXT_PUBLIC_ and is only available in API routes
export const createServerSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export default supabaseClient
