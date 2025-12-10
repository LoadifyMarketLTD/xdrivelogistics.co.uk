// Minimal Supabase client helper — uses existing environment variable names (unchanged)
import { createClient } from '@supabase/supabase-js'

// Use NEXT_PUBLIC_* values on the client if present, otherwise fallback to server env names
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL || process.env.SUPABASE_DATABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

// Create a safe client for use in client-side components
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
})

export default supabaseClient
