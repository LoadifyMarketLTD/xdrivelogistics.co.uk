/** Restrict legacy workspace database integration to the authorized XDrive production project. */
export const XDRIVE_PRODUCTION_PROJECT_REF = 'jqxlauexhkonixtjvljw';

export function isAuthorizedXDriveProductionUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === `${XDRIVE_PRODUCTION_PROJECT_REF}.supabase.co` && !url.username && !url.password && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  } catch {
    return false;
  }
}
