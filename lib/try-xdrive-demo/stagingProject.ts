/** Restrict demo database integration to the explicitly authorized staging project. */
export const XDRIVE_DEMO_STAGING_REF = 'svfjlhljuizckzabtewx';

export function isAuthorizedDemoStagingUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === `${XDRIVE_DEMO_STAGING_REF}.supabase.co` && !url.username && !url.password && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  } catch {
    return false;
  }
}
