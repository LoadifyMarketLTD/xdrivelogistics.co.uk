import { supabase } from '../../../lib/supabaseClient';

/**
 * Retrieves the current Supabase access token from the active session.
 *
 * This utility was duplicated verbatim in the drivers and dispatchers admin
 * pages. It is now the single canonical implementation.
 */
export async function getAccessToken(): Promise<{ accessToken: string | null; error: string | null }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { accessToken: null, error: sessionError.message };
  if (sessionData.session?.access_token) return { accessToken: sessionData.session.access_token, error: null };
  return { accessToken: null, error: 'Session expired. Please sign in again.' };
}
