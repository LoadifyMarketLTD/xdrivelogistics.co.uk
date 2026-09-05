import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type CountResult = { count: number | null; error: { message?: string } | null };

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const [total, active, suspended, pending, rejected] = await Promise.all([
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ]) as CountResult[];

  const entries = [
    ['total', total], ['active', active], ['suspended', suspended], ['pending', pending], ['rejected', rejected],
  ] as const;
  const failed = entries.find(([, result]) => result.error || typeof result.count !== 'number');
  if (failed) {
    return respond(500, {
      error: `Company governance summary source unavailable: ${failed[0]}.`,
      detail: failed[1].error?.message ?? null,
    });
  }

  return respond(200, {
    refreshedAt: new Date().toISOString(),
    total: total.count,
    active: active.count,
    suspended: suspended.count,
    pending: pending.count,
    rejected: rejected.count,
  });
}
