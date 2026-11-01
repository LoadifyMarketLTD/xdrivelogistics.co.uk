import { getSupabase } from '../supabaseClient';
import { isAuthorizedDemoStagingUrl } from './stagingProject';

/** Local testing only: wait for an explicit signed actor session before requesting project data. */
let autonomousClientActorSelected=false;
let autonomousSessionEpoch=0;
/** Invalidate every in-flight response on account switch. A response from
 * Company A must never repopulate the UI after switching to Company B. */
export function markAutonomousLocalActor(ready:boolean){
 autonomousClientActorSelected=ready;
 autonomousSessionEpoch++;
}
export function getAutonomousSessionEpoch(){return autonomousSessionEpoch}

/** Fail closed: never send a demo bearer token to a non-staging project. */
export async function authenticatedDemoFetch(input: string, init: RequestInit = {}): Promise<Response> {
  // The NEW isolated XDrive DEMO never sends bearer tokens or data to legacy Staging.
  if (process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO === '1') {
    if (!input.startsWith('/api/try-xdrive-demo/')) throw Error('Only autonomous DEMO API routes are allowed');
    if (!autonomousClientActorSelected) throw Error('Choose an isolated local test workspace first');
    let localPath = input.replace('/api/try-xdrive-demo/', '/api/autonomous/v1/');
    if(localPath==='/api/autonomous/v1/fleet'&&(!init.method||init.method==='GET'))
      localPath+='?view=workspace';
    return fetch(localPath, {...init,credentials:'same-origin',cache:'no-store'});
  }
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
