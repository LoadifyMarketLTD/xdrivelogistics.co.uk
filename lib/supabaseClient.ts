import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate that variables exist
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Missing Supabase credentials!\n\n' +
    'Required environment variables:\n' +
    `- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}\n` +
    `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}\n\n` +
    'Please check your Netlify environment variables:\n' +
    '1. Go to Netlify Dashboard → Site Settings → Environment Variables\n' +
    '2. Verify these variables are set with correct values\n' +
    '3. Get the correct values from: https://supabase.com/dashboard/project/_/settings/api\n' +
    '4. Redeploy after updating variables'
  );
}

// Validate that values are not placeholders
if (
  supabaseUrl.includes('your-project') || 
  supabaseUrl.includes('placeholder') ||
  !supabaseUrl.includes('supabase.co')
) {
  throw new Error(
    '❌ Invalid Supabase URL!\n\n' +
    `Current value: ${supabaseUrl}\n\n` +
    'This appears to be a placeholder value.\n' +
    'Please set the correct URL from your Supabase project:\n' +
    'https://supabase.com/dashboard/project/_/settings/api'
  );
}

if (
  supabaseAnonKey.includes('your-anon-key') || 
  supabaseAnonKey.includes('placeholder') ||
  supabaseAnonKey.length < 20
) {
  throw new Error(
    '❌ Invalid Supabase Anon Key!\n\n' +
    'This appears to be a placeholder or invalid value.\n' +
    'Please set the correct anon key from your Supabase project:\n' +
    'https://supabase.com/dashboard/project/_/settings/api'
  );
}

// Create and export Supabase client with proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Log successful initialization (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Supabase client initialized successfully');
  console.log('📍 Project URL:', supabaseUrl);
}
