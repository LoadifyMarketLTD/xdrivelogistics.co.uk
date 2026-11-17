import type { NextRequest } from 'next/server';
import { isCrmProductionWriteAllowed, isCrmStagingWriteAllowed } from '@/lib/business-development/crmWriteGate';
import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

export const crmResponse = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

/**
 * CRM mutations are permitted only on the separately attested isolated
 * staging origin or explicitly enabled, exact XDrive Production origin.
 * All previews remain read-only.
 */
export function crmWriteEnabled(): boolean {
  const connectedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const production = isCrmProductionWriteAllowed({
    context: process.env.CONTEXT,
    vercelEnvironment: process.env.VERCEL_ENV,
    deploymentIsPreview: isSuperAdminDeployPreviewReadOnly(),
    enabled: process.env.XDRIVE_CRM_PRODUCTION_WRITES,
    databaseScope: process.env.XDRIVE_CRM_DATABASE_SCOPE,
    connectedSupabaseUrl,
  });
  return production || isCrmStagingWriteAllowed({
    context: process.env.CONTEXT,
    vercelEnvironment: process.env.VERCEL_ENV,
    deploymentIsPreview: isSuperAdminDeployPreviewReadOnly(),
    enabled: process.env.XDRIVE_CRM_STAGING_WRITES,
    databaseScope: process.env.XDRIVE_CRM_DATABASE_SCOPE,
    stagingSupabaseUrl: process.env.XDRIVE_CRM_STAGING_SUPABASE_URL,
    connectedSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim(),
  });
}

export async function authorizeCrm(request: NextRequest, write = false) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin)
    return { error: crmResponse(503, { error: 'CRM storage unavailable.' }), owner: null };
  if (!hasSuperAdminBearerAuthorization(request))
    return { error: crmResponse(401, { error: 'Authentication required.' }), owner: null };
  const owner = await verifyPlatformOwner(request);
  if (!owner) return { error: crmResponse(403, { error: 'Active Platform Owner required.' }), owner: null };
  if (write && !crmWriteEnabled())
    return { error: crmResponse(403, { error: 'CRM mutations unavailable in this deployment or database; verified owner and explicit release gate required.' }), owner: null };
  return { error: null, owner };
}

export const crmUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function crmHttps(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname &&
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch { return false; }
}
export const crmTrimmed = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
export function crmDomain(website: string): string | null {
  if (!crmHttps(website)) return null;
  const host = new URL(website).hostname.toLowerCase().replace(/^www\./, '');
  return host.length <= 253 ? host : null;
}
