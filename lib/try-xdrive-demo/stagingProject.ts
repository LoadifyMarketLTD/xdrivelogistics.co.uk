/** Allow only the two explicitly identified XDrive Supabase projects. */
export const XDRIVE_DEMO_STAGING_REF = 'svfjlhljuizckzabtewx';
export const XDRIVE_REAL_REF = 'jqxlauexhkonixtjvljw';

export function isAuthorizedDemoStagingUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const approved = new Set([XDRIVE_DEMO_STAGING_REF, XDRIVE_REAL_REF]);
    const ref = url.hostname.replace(/\.supabase\.co$/, '');
    return url.protocol === 'https:' && url.hostname === `${ref}.supabase.co` && approved.has(ref) && !url.username && !url.password && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  } catch { return false; }
}
