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
    return declared.protocol==='https:' && actual.protocol==='https:' &&
      declared.origin===actual.origin &&
      declared.hostname.endsWith('.supabase.co') &&
      declared.hostname!=='.supabase.co' &&
      !declared.username && !declared.password && !actual.username && !actual.password &&
      declared.pathname==='/' && actual.pathname==='/';
  } catch{return false;}
}
