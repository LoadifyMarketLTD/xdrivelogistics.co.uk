import { supabase } from '@/lib/supabaseClient';

/**
 * Returns an Authorization header value (`****** for the active
 * Supabase session, or `null` when no session exists.
 *
 * This utility was duplicated verbatim across every super-admin page and
 * shared component. It is now the single canonical implementation.
 */
export async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return ['Bearer', session.access_token].join(' ');
}
