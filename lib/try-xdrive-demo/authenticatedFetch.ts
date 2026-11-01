import { getSupabase } from '../supabaseClient';
import { isAuthorizedRealXDriveUrl } from './realProject';

let sessionEpoch=0;
export function markAutonomousLocalActor(_ready:boolean){sessionEpoch++}
export function getAutonomousSessionEpoch(){return sessionEpoch}

/** Only the verified real XDrive Supabase JWT may access these workspace APIs. */
export async function authenticatedDemoFetch(input:string,init:RequestInit={}):Promise<Response>{
  if(!input.startsWith('/api/try-xdrive-demo/'))throw new Error('Workspace API path not permitted');
  if(!isAuthorizedRealXDriveUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)){
    throw new Error('Real XDrive Supabase URL is required; staging is not permitted');
  }
  const client=getSupabase();
  if(!client)throw new Error('Real XDrive Supabase client unavailable');
  const {data,error}=await client.auth.getSession();
  if(error||!data.session?.access_token)throw new Error('Sign in to XDrive to continue');
  const headers=new Headers(init.headers);
  headers.set('Authorization',`Bearer ${data.session.access_token}`);
  return fetch(input,{...init,headers,cache:'no-store'});
}
