import type { SupabaseClient } from '@supabase/supabase-js';

export type TransportBuyerRiskSnapshot = {
  company_id: string;
  risk_mode: 'restricted' | 'cleared' | 'blocked';
  configured_mode: 'restricted' | 'cleared' | 'blocked';
  is_new_buyer: boolean;
  paid_invoice_count: number;
  active_commitments: number;
  outstanding_exposure_gbp: number;
  projected_amount_gbp: number;
  projected_exposure_gbp: number;
  max_active_commitments: number;
  max_outstanding_exposure_gbp: number;
  allowed: boolean;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export async function getTransportBuyerRiskSnapshot(
  admin: SupabaseClient,
  companyId: string,
  projectedAmountGbp = 0,
): Promise<{ snapshot: TransportBuyerRiskSnapshot | null; infrastructureAvailable: boolean; error: string | null }> {
  const { data, error } = await admin.rpc('fn_transport_buyer_risk_snapshot', {
    p_company_id: companyId,
    p_projected_amount_gbp: Math.max(0, Number.isFinite(projectedAmountGbp) ? projectedAmountGbp : 0),
  });
  if (error) {
    const code = String(error.code ?? '');
    if (['42883', '42P01', 'PGRST202', 'PGRST205'].includes(code)) {
      return { snapshot: null, infrastructureAvailable: false, error: error.message };
    }
    throw error;
  }
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== 'object') return { snapshot: null, infrastructureAvailable: false, error: 'Transport buyer risk snapshot returned no data.' };
  return { snapshot: raw as TransportBuyerRiskSnapshot, infrastructureAvailable: true, error: null };
}

export async function logTransportBuyerRiskBlockedEvent(
  admin: SupabaseClient,
  snapshot: TransportBuyerRiskSnapshot,
  eventType: 'publish_blocked' | 'award_blocked',
  actorUserId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from('transport_buyer_risk_events').insert({
    company_id: snapshot.company_id,
    actor_user_id: actorUserId,
    event_type: eventType,
    active_commitments: snapshot.active_commitments,
    outstanding_exposure_gbp: snapshot.outstanding_exposure_gbp,
    projected_exposure_gbp: snapshot.projected_exposure_gbp,
    reason: snapshot.reason,
    metadata: { ...snapshot, ...metadata, source: 'api_precheck' },
  });
  if (error) throw error;
}

export const transportBuyerRiskBlockedPayload = (snapshot: TransportBuyerRiskSnapshot) => ({
  error: snapshot.reason ?? 'Transport buyer risk limit prevents new transport commitments.',
  code: 'TRANSPORT_BUYER_RISK_LIMIT',
  risk: {
    mode: snapshot.risk_mode,
    isNewBuyer: snapshot.is_new_buyer,
    activeCommitments: snapshot.active_commitments,
    maxActiveCommitments: snapshot.max_active_commitments,
    outstandingExposureGbp: snapshot.outstanding_exposure_gbp,
    projectedExposureGbp: snapshot.projected_exposure_gbp,
    maxOutstandingExposureGbp: snapshot.max_outstanding_exposure_gbp,
  },
});
