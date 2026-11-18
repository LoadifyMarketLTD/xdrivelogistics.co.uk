import { getSupabase } from '../supabaseClient';
import { isAuthorizedXDriveProductionUrl } from './productionProject';

/** Fail closed: send user tokens only to APIs backed by the authorized XDrive production project. */
export async function authenticatedDemoFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (!isAuthorizedXDriveProductionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('XDrive production Supabase connection is not configured');
  }
  const client = getSupabase();
  if (!client) throw new Error('XDrive authentication unavailable');
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('XDrive Demo authentication required');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
