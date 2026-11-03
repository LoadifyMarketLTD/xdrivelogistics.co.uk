import { getSupabase } from '../supabaseClient';
import { isAuthorizedDemoStagingUrl } from './stagingProject';

/** Fail closed: never send a demo bearer token to a non-staging project. */
export async function authenticatedDemoFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (!isAuthorizedDemoStagingUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('XDrive Demo requires its dedicated Supabase staging project');
  }
  const client = getSupabase();
  if (!client) throw new Error('Supabase staging session unavailable');
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('XDrive Demo authentication required');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
