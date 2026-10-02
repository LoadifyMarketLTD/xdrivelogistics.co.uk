import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const DECISION_ROLES = new Set(['owner', 'admin', 'dispatcher']);
const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const jsonRecord = z.record(z.string(), z.unknown());
const jobPatchSchema = z.object({
  pickup: jsonRecord.optional(),
  delivery: jsonRecord.optional(),
  cargo: jsonRecord.optional(),
  requirements: jsonRecord.optional(),
  references: jsonRecord.optional(),
}).strict().optional();

const proposalSchema = z.object({
  actingCompanyId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(2000),
  agreedAmount: z.number().finite().positive().max(10_000_000).optional(),
  paymentTerms: z.enum(['Pay now', '14 days', '30 days']).optional(),
  podRequired: z.boolean().optional(),
  jobPatch: jobPatchSchema,
  verbalAgreementConfirmed: z.boolean().optional().default(false),
  verbalAgreementNote: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.podRequired != null) {
    ctx.addIssue({ code: 'custom', path: ['podRequired'], message: 'Electronic POD is mandatory for every job and cannot be amended.' });
  }
  if (value.agreedAmount == null && value.paymentTerms == null && !value.jobPatch) {
    ctx.addIssue({ code: 'custom', message: 'At least one contractual change is required.' });
  }
  if (value.jobPatch && JSON.stringify(value.jobPatch).length > 20_000) {
    ctx.addIssue({ code: 'custom', message: 'Job amendment payload is too large.' });
  }
  if (value.verbalAgreementNote && !value.verbalAgreementConfirmed) {
    ctx.addIssue({ code: 'custom', message: 'Confirm the verbal agreement before adding a verbal agreement note.' });
  }
});

type EffectiveAgreement = {
  id: string;
  job_id: string;
  buyer_company_id: string;
  supplier_company_id: string;
  agreed_amount: number | string;
  currency: string;
  vat_treatment: string;
  vat_rate: number;
  vat_amount: number | string;
  agreed_gross_amount: number | string;
  payment_terms: string;
  payment_due_days: number;
  pod_required: boolean;
  job_snapshot: Record<string, unknown> | null;
  contract_snapshot_hash: string;
  contract_version: number;
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? { ...(value as Record<string, unknown>) }
  : {};

const JOB_PATCH_SECTIONS = ['pickup', 'delivery', 'cargo', 'requirements', 'references'] as const;

const mergeJobSnapshot = (base: unknown, patch: z.infer<typeof jobPatchSchema>) => {
  const next = asObject(base);
  if (!patch) return next;
  for (const key of JOB_PATCH_SECTIONS) {
    if (!patch[key]) continue;
    next[key] = { ...asObject(next[key]), ...patch[key] };
  }
  return next;
};

const describeJobPatch = (base: unknown, patch: z.infer<typeof jobPatchSchema>) => {
  const baseSnapshot = asObject(base);
  const changes: Record<string, Record<string, { from: unknown; to: unknown }>> = {};
  if (!patch) return changes;

  for (const section of JOB_PATCH_SECTIONS) {
    const proposed = patch[section];
    if (!proposed) continue;
    const current = asObject(baseSnapshot[section]);
    const sectionChanges: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, to] of Object.entries(proposed)) {
      const from = Object.prototype.hasOwnProperty.call(current, field) ? current[field] : null;
      if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
      sectionChanges[field] = { from: from ?? null, to: to ?? null };
    }
    if (Object.keys(sectionChanges).length) changes[section] = sectionChanges;
  }
  return changes;
};

const numberValue = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { response: respond(503, { error: 'Server auth is not configured.' }) } as const;
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  return { user: data.user } as const;
}

async function loadAgreement(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('job_commercial_agreements_effective')
    .select('id,job_id,buyer_company_id,supplier_company_id,agreed_amount,currency,vat_treatment,vat_rate,vat_amount,agreed_gross_amount,payment_terms,payment_due_days,pod_required,job_snapshot,contract_snapshot_hash,contract_version')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) return { error } as const;
  return { agreement: data as EffectiveAgreement | null } as const;
}

async function authorisedCompanies(userId: string, agreement: EffectiveAgreement) {
  const { data, error } = await supabaseAdmin!
    .from('company_memberships')
    .select('company_id, role_in_company')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('company_id', [agreement.buyer_company_id, agreement.supplier_company_id]);
  if (error) return { error } as const;
  const companyIds = (data ?? [])
    .filter((row) => DECISION_ROLES.has(String(row.role_in_company ?? '').trim().toLowerCase()))
    .map((row) => String(row.company_id));
  return { companyIds: [...new Set(companyIds)] } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { jobId } = await params;
  const loaded = await loadAgreement(jobId);
  if (loaded.error) {
    const code = String(loaded.error.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Commercial amendment schema is not available.' });
    return respond(500, { error: loaded.error.message });
  }
  if (!loaded.agreement) return respond(404, { error: 'Accepted commercial agreement not found.' });
  const access = await authorisedCompanies(auth.user.id, loaded.agreement);
  if (access.error) return respond(500, { error: access.error.message });
  if (!access.companyIds.length) return respond(403, { error: 'You are not authorised to manage this commercial agreement.' });

  const { data: amendments, error } = await supabaseAdmin!
    .from('job_commercial_agreement_amendments')
    .select('id,agreement_id,job_id,version_number,proposed_by_user_id,proposed_by_company_id,counterparty_company_id,reason,change_summary,base_snapshot_hash,effective_agreed_amount,currency,vat_treatment,vat_rate,vat_amount,effective_gross_amount,payment_terms,payment_due_days,pod_required,effective_job_snapshot,effective_snapshot_hash,status,proposed_at,decided_by_user_id,decided_by_company_id,decision_note,decided_at,created_at')
    .eq('agreement_id', loaded.agreement.id)
    .order('version_number', { ascending: false });
  if (error) return respond(500, { error: error.message });
  return respond(200, { agreement: loaded.agreement, actingCompanyIds: access.companyIds, amendments: amendments ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const parsed = proposalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid amendment proposal.' });
  const { jobId } = await params;
  const loaded = await loadAgreement(jobId);
  if (loaded.error) {
    const code = String(loaded.error.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Commercial amendment schema is not available.' });
    return respond(500, { error: loaded.error.message });
  }
  const agreement = loaded.agreement;
  if (!agreement) return respond(404, { error: 'Accepted commercial agreement not found.' });
  const access = await authorisedCompanies(auth.user.id, agreement);
  if (access.error) return respond(500, { error: access.error.message });
  if (!access.companyIds.length) return respond(403, { error: 'You are not authorised to propose a commercial amendment.' });

  let actingCompanyId: string;
  if (parsed.data.actingCompanyId) {
    if (!access.companyIds.includes(parsed.data.actingCompanyId)) return respond(403, { error: 'The selected acting company is not authorised for this agreement.' });
    actingCompanyId = parsed.data.actingCompanyId;
  } else if (access.companyIds.length === 1) {
    actingCompanyId = access.companyIds[0];
  } else {
    return respond(409, { error: 'Choose which contractual company you are acting for.' });
  }

  const currentAmount = numberValue(agreement.agreed_amount);
  if (!currentAmount) return respond(409, { error: 'The effective agreement amount is invalid.' });
  const nextAmount = parsed.data.agreedAmount ?? currentAmount;
  const nextPaymentTerms = parsed.data.paymentTerms ?? agreement.payment_terms;
  const nextPodRequired = true;
  const nextJobSnapshot = mergeJobSnapshot(agreement.job_snapshot, parsed.data.jobPatch);

  const summary: Record<string, unknown> = {};
  if (Math.abs(nextAmount - currentAmount) > 0.009) summary.agreedAmount = { from: currentAmount, to: nextAmount };
  if (nextPaymentTerms !== agreement.payment_terms) summary.paymentTerms = { from: agreement.payment_terms, to: nextPaymentTerms };
  const jobChanges = describeJobPatch(agreement.job_snapshot, parsed.data.jobPatch);
  if (parsed.data.jobPatch && Object.keys(jobChanges).length) {
    summary.jobPatch = parsed.data.jobPatch;
    summary.jobChanges = jobChanges;
  }
  if (parsed.data.verbalAgreementConfirmed) {
    summary.verbalAgreement = {
      confirmed: true,
      note: parsed.data.verbalAgreementNote || null,
      confirmedByUserId: auth.user.id,
      confirmedAt: new Date().toISOString(),
    };
  }
  if (!Object.keys(summary).some((key) => key !== 'verbalAgreement')) return respond(400, { error: 'The proposal does not change the current effective contract.' });

  const { data: amendment, error } = await supabaseAdmin!
    .from('job_commercial_agreement_amendments')
    .insert({
      agreement_id: agreement.id,
      proposed_by_user_id: auth.user.id,
      proposed_by_company_id: actingCompanyId,
      reason: parsed.data.reason,
      change_summary: summary,
      effective_agreed_amount: nextAmount,
      currency: agreement.currency,
      vat_treatment: agreement.vat_treatment,
      vat_rate: agreement.vat_rate,
      vat_amount: numberValue(agreement.vat_amount) ?? 0,
      effective_gross_amount: numberValue(agreement.agreed_gross_amount) ?? nextAmount,
      payment_terms: nextPaymentTerms,
      payment_due_days: agreement.payment_due_days,
      pod_required: nextPodRequired,
      effective_job_snapshot: nextJobSnapshot,
    })
    .select('id,agreement_id,job_id,version_number,proposed_by_company_id,counterparty_company_id,reason,change_summary,base_snapshot_hash,effective_agreed_amount,currency,vat_treatment,vat_rate,vat_amount,effective_gross_amount,payment_terms,payment_due_days,pod_required,effective_job_snapshot,effective_snapshot_hash,status,proposed_at,created_at')
    .single();

  if (error) {
    if (error.code === '23505') return respond(409, { error: 'Another commercial amendment is already awaiting a decision.' });
    if (error.code === '23514') return respond(409, { error: error.message });
    return respond(500, { error: error.message });
  }

  await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: 'commercial_amendment_proposed',
    event_time: new Date().toISOString(),
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: `Commercial amendment v${amendment.version_number} proposed.`,
    meta: { amendment_id: amendment.id, version_number: amendment.version_number, proposed_by_company_id: actingCompanyId, change_summary: summary },
  }).then(() => undefined, () => undefined);

  const { data: assignedJob } = await supabaseAdmin!
    .from('jobs')
    .select('assigned_driver_id')
    .eq('id', jobId)
    .maybeSingle();
  let assignedDriverUserId: string | null = null;
  if (assignedJob?.assigned_driver_id) {
    const { data: assignedDriver } = await supabaseAdmin!
      .from('drivers')
      .select('user_id')
      .eq('id', assignedJob.assigned_driver_id)
      .maybeSingle();
    assignedDriverUserId = String(assignedDriver?.user_id ?? '').trim() || null;
  }

  await supabaseAdmin!.from('notification_events').insert({
    event_type: 'commercial_amendment_proposed',
    entity_type: 'job',
    entity_id: jobId,
    company_id: amendment.counterparty_company_id,
    recipient_user_id: assignedDriverUserId,
    payload: {
      job_id: jobId,
      amendment_id: amendment.id,
      version_number: amendment.version_number,
      reason: parsed.data.reason,
      effective_agreed_amount: nextAmount,
      currency: agreement.currency,
      proposed_by_company_id: actingCompanyId,
      counterparty_company_id: amendment.counterparty_company_id,
      message: `Job change v${amendment.version_number} requires acceptance. Open XDrive to review the changes.`,
    },
  }).then(() => undefined, () => undefined);

  return respond(201, { amendment });
}
