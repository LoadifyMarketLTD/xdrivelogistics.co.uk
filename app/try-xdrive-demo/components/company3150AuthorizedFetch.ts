import { supabase } from '../../../lib/supabaseClient';

/** Uses only the signed-in user's access token. All target API routes
 * independently check membership, permissions and recipient visibility.
 */
export async function company3150AuthorizedFetch<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  if (!endpoint.startsWith('/api/')) throw new Error('Only XDrive API routes are allowed.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign-in is required to load company records.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + data.session.access_token);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(endpoint, { ...init, headers, cache: 'no-store' });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = json && typeof json === 'object' && 'error' in json
      ? String((json as { error?: unknown }).error || 'Request failed.')
      : 'Request failed.';
    throw new Error(message);
  }
  return json as T;
}
