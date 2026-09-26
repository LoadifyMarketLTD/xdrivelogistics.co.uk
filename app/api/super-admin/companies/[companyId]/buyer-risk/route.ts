import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin, isSupabaseAdminConfigured } from '../../../../_lib/supabaseAdmin';
import { getTransportBuyerRiskSnapshot } from '../../../../_lib/transportBuyerRisk';
import { verifyPlatformOwner } from '../../../_lib/verifyPlatformOwner';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const reviewSchema = z.object({
  mode: z.enum(['restricted', 'cleared', 'blocked']),
  maxActiveCommitments: z.number().int().min(0).max(10000),
  maxOutstandingExposureGbp: z.number().finite().min(0).max(9999999999),
  reason: z.string().trim().min(5).max(2000),
});

type Params = { params: Promise<{ companyId: string }> };

async function companyExists(companyId: string) {
  const { data, error } = await supabaseAdmin!.from('companies').select('id,name,status,created_at').eq('id', companyId).maybeSingle();
  if (error) return { company: null, error } as const;
  return { company: data, error: null } as const;
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  const { companyId } = await params;
  const companyResult = await companyExists(companyId);
  if (companyResult.error) return respond(500, { error: companyResult.error.message });
  if (!companyResult.company) return respond(404, { error: 'Company not found.' });

  const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, companyId, 0);
  if (!risk.infrastructureAvailable || !risk.snapshot) {
    return respond(503, { error: 'Transport buyer risk controls are not available in this environment.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' });
  }
  const { data: events, error: eventError } = await supabaseAdmin
    .from('transport_buyer_risk_events')
    .select('id,event_type,actor_user_id,previous_mode,new_mode,active_commitments,outstanding_exposure_gbp,projected_exposure_gbp,reason,metadata,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (eventError) return respond(500, { error: eventError.message });
  return respond(200, { company: companyResult.company, risk: risk.snapshot, events: events ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  const { companyId } = await params;
  const companyResult = await companyExists(companyId);
  if (companyResult.error) return respond(500, { error: companyResult.error.message });
  if (!companyResult.company) return respond(404, { error: 'Company not found.' });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid buyer-risk review.' });

  const { data, error } = await supabaseAdmin.rpc('fn_review_transport_buyer_risk', {
    p_company_id: companyId,
    p_actor_user_id: owner.id,
    p_risk_mode: parsed.data.mode,
    p_max_active_commitments: parsed.data.maxActiveCommitments,
    p_max_outstanding_exposure_gbp: parsed.data.maxOutstandingExposureGbp,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const code = String(error.code ?? '');
    if (['42883','42P01','PGRST202','PGRST205'].includes(code)) return respond(503, { error: 'Transport buyer risk review is not available in this environment.' });
    if (['42501','22023'].includes(code)) return respond(code === '42501' ? 403 : 400, { error: error.message });
    return respond(500, { error: error.message });
  }
  const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, companyId, 0);
  return respond(200, { control: Array.isArray(data) ? data[0] : data, risk: risk.snapshot });
}
