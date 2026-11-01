/** Restrict operational workspace access to the verified XDrive production Supabase project. */
export const XDRIVE_REAL_PROJECT_REF = 'jqxlauexhkonixtjvljw';

export function isAuthorizedRealXDriveUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === `${XDRIVE_REAL_PROJECT_REF}.supabase.co` && !url.username && !url.password && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  } catch {
    return false;
  }
}
