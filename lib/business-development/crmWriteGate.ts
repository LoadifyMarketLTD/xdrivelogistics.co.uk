/** Pure, auditable guard for the XDrive CRM. No network calls. */
export type CrmWriteGateInput = {
  context?: string;
  vercelEnvironment?: string;
  deploymentIsPreview: boolean;
  enabled?: string;
  databaseScope?: string;
  stagingSupabaseUrl?: string;
  connectedSupabaseUrl?: string;
};
export type CrmProductionWriteGateInput = {
  context?: string;
  vercelEnvironment?: string;
  deploymentIsPreview: boolean;
  enabled?: string;
  databaseScope?: string;
  connectedSupabaseUrl?: string;
};

/** Production mutations require an explicit, independently configured release
 * flag AND the exact XDrive Production Supabase origin; no previews or Loadify.
 * A mere CRM code deployment never turns on write access by itself. */
export function isCrmProductionWriteAllowed(input: CrmProductionWriteGateInput): boolean {
  if (input.deploymentIsPreview ||
      input.context !== 'production' ||
      (input.vercelEnvironment && input.vercelEnvironment !== 'production') ||
      input.enabled !== 'enabled' ||
      input.databaseScope !== 'production_xdrive') return false;
  try {
    const actual = new URL(input.connectedSupabaseUrl ?? '');
    return actual.origin === 'https://jqxlauexhkonixtjvljw.supabase.co' &&
      actual.pathname === '/' && !actual.username && !actual.password &&
      !actual.search && !actual.hash;
  } catch {
    return false;
  }
}

export function isCrmStagingWriteAllowed(input: CrmWriteGateInput): boolean {
  const context=(input.context??'').trim().toLowerCase();
  const vercel=(input.vercelEnvironment??'').trim().toLowerCase();
  if(input.deploymentIsPreview || context==='production' || context==='deploy-preview' ||
     vercel==='production' || vercel==='preview')return false;
  if(input.enabled!=='enabled' || input.databaseScope!=='isolated_staging')return false;
  if(!input.stagingSupabaseUrl || !input.connectedSupabaseUrl)return false;
  try {
    const declared=new URL(input.stagingSupabaseUrl);
    const actual=new URL(input.connectedSupabaseUrl);
    // Known company Production projects are hard-denied even if staging env
    // variables are accidentally pointed at the live Supabase URL.
    const blockedProductionOrigins = new Set([
      'https://jqxlauexhkonixtjvljw.supabase.co',
      'https://fwdfpmfvgygvqciecesx.supabase.co',
    ]);
    return declared.protocol==='https:' && actual.protocol==='https:' &&
      declared.origin===actual.origin &&
      !blockedProductionOrigins.has(actual.origin) &&
      declared.hostname.endsWith('.supabase.co') &&
      declared.hostname!=='.supabase.co' &&
      !declared.username && !declared.password && !actual.username && !actual.password &&
      declared.pathname==='/' && actual.pathname==='/';
  } catch{return false;}
}
