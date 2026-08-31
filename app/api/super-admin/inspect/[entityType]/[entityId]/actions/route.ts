import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const CASE_SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205']);
const ACTIVE_CASE_STATUSES = ['open', 'acknowledged', 'investigating', 'waiting'] as const;
const OPERATIONS_ENTITY_TYPES = new Set(['job', 'driver', 'vehicle', 'pod', 'dispute']);

type ActionTone = 'primary' | 'secondary' | 'warning' | 'danger';
type ActionDescriptor = {
  id: string;
  label: string;
  description: string;
  requiresReason: boolean;
  tone: ActionTone;
  caseSeverity?: 'P0' | 'P1' | 'P2' | 'P3';
};

type ActiveCaseRow = {
  id: string;
  reference: string;
  severity: string;
  status: string;
  title: string;
};

const isCaseSchemaUnavailable = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && CASE_SCHEMA_UNAVAILABLE_CODES.has(error.code));

const CASE_ACTIONS: ActionDescriptor[] = [
  {
    id: 'open_case_p0',
    label: 'Open P0 case',
    description: 'Create a critical platform investigation for an immediate service, security or transaction-threatening exception.',
    requiresReason: true,
    tone: 'danger',
    caseSeverity: 'P0',
  },
  {
    id: 'open_case_p1',
    label: 'Open P1 case',
    description: 'Create a high-priority operational investigation requiring urgent Platform Owner attention.',
    requiresReason: true,
    tone: 'warning',
    caseSeverity: 'P1',
  },
  {
    id: 'open_case_p2',
    label: 'Open P2 case',
    description: 'Create a standard operational exception investigation for this entity.',
    requiresReason: true,
    tone: 'primary',
    caseSeverity: 'P2',
  },
  {
    id: 'open_case_p3',
    label: 'Open P3 case',
    description: 'Create a lower-priority investigation for a non-urgent operational exception.',
    requiresReason: true,
    tone: 'secondary',
    caseSeverity: 'P3',
  },
];

const marketplaceActionsFor = (status: string, exchangeVisibility: string): ActionDescriptor[] => {
  const normalizedStatus = status.toLowerCase();
  const actions: ActionDescriptor[] = [];

  if (exchangeVisibility === 'exchange') {
    actions.push({
      id: 'hide_from_exchange',
      label: 'Hide from exchange',
      description: 'Remove this job from marketplace exchange visibility using the canonical governance action.',
      requiresReason: false,
      tone: 'secondary',
    });
  } else if (normalizedStatus === 'draft' || normalizedStatus === 'posted') {
    actions.push({
      id: 'publish_to_exchange',
      label: 'Publish to exchange',
      description: 'Publish this eligible job to the marketplace exchange using the canonical governance action.',
      requiresReason: false,
      tone: 'primary',
    });
  }

  if (['draft', 'posted', 'allocated', 'in_transit'].includes(normalizedStatus)) {
    actions.push({
      id: 'force_dispute',
      label: 'Force dispute',
      description: 'Place the live job into the canonical marketplace dispute state. A recorded reason is required.',
      requiresReason: true,
      tone: 'warning',
    });
    actions.push({
      id: 'force_cancel',
      label: 'Force cancel',
      description: 'Cancel the live job through the canonical marketplace governance mutation. A recorded reason is required.',
      requiresReason: true,
      tone: 'danger',
    });
  }

  return actions;
};

async function entityExists(entityType: string, entityId: string) {
  if (!supabaseAdmin) return { exists: false, label: entityId, companyId: null as string | null, status: null as string | null, exchangeVisibility: null as string | null };

  if (entityType === 'job' || entityType === 'pod') {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('id, load_ref, load_id, title, status, current_status, exchange_visibility, company_id')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.load_ref ?? data.load_id ?? data.title ?? data.id) : entityId,
      companyId: data?.company_id ? String(data.company_id) : null,
      status: data ? String(data.current_status ?? data.status ?? '') : null,
      exchangeVisibility: data ? String(data.exchange_visibility ?? '') : null,
    };
  }

  if (entityType === 'driver') {
    const { data, error } = await supabaseAdmin.from('drivers').select('id, display_name, full_name, name, company_id, status').eq('id', entityId).maybeSingle();
    if (error) throw new Error(error.message);
    return { exists: Boolean(data), label: data ? String(data.display_name ?? data.full_name ?? data.name ?? data.id) : entityId, companyId: data?.company_id ? String(data.company_id) : null, status: data?.status ? String(data.status) : null, exchangeVisibility: null };
  }

  if (entityType === 'vehicle') {
    const { data, error } = await supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, vehicle_reference, company_id, status, current_status').eq('id', entityId).maybeSingle();
    if (error) throw new Error(error.message);
    return { exists: Boolean(data), label: data ? String(data.registration ?? data.reg_plate ?? data.reg ?? data.vehicle_reference ?? data.id) : entityId, companyId: data?.company_id ? String(data.company_id) : null, status: data ? String(data.current_status ?? data.status ?? '') : null, exchangeVisibility: null };
  }

  if (entityType === 'dispute') {
    const { data, error } = await supabaseAdmin.from('job_disputes').select('id, job_id, raised_by_company_id, status, description').eq('id', entityId).maybeSingle();
    if (error) throw new Error(error.message);
    return { exists: Boolean(data), label: data ? String(data.description ?? `Dispute ${data.id}`) : entityId, companyId: data?.raised_by_company_id ? String(data.raised_by_company_id) : null, status: data?.status ? String(data.status) : null, exchangeVisibility: null };
  }

  return { exists: false, label: entityId, companyId: null, status: null, exchangeVisibility: null };
}

export async function GET(request: NextRequest, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { entityType: rawType, entityId: rawId } = await context.params;
  const entityType = decodeURIComponent(rawType).toLowerCase();
  const entityId = decodeURIComponent(rawId).trim();
  if (!OPERATIONS_ENTITY_TYPES.has(entityType)) {
    return respond(200, { entityType, entityId, supported: false, actions: [], activeCases: [], caseCentreAvailable: null });
  }

  let entity;
  try {
    entity = await entityExists(entityType, entityId);
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Failed to resolve inspector action state.' });
  }
  if (!entity.exists) return respond(404, { error: `${entityType} entity not found.` });

  const actions: ActionDescriptor[] = [];
  if (entityType === 'job') actions.push(...marketplaceActionsFor(entity.status ?? '', entity.exchangeVisibility ?? ''));

  const caseResult = await supabaseAdmin
    .from('platform_cases')
    .select('id, reference, severity, status, title')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .in('status', [...ACTIVE_CASE_STATUSES])
    .order('updated_at', { ascending: false })
    .limit(10);

  let caseCentreAvailable = true;
  let caseCentreNote: string | null = null;
  let activeCases: ActiveCaseRow[] = [];

  if (caseResult.error) {
    if (!isCaseSchemaUnavailable(caseResult.error)) return respond(500, { error: caseResult.error.message });
    caseCentreAvailable = false;
    caseCentreNote = 'Platform Case Centre schema is not applied in this environment. Case-opening actions are suppressed.';
  } else {
    activeCases = (caseResult.data ?? []).map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      severity: String(row.severity),
      status: String(row.status),
      title: String(row.title),
    }));
    if (activeCases.length === 0) actions.push(...CASE_ACTIONS);
    else caseCentreNote = 'An active Platform Case already exists for this entity. Open the existing case instead of creating a duplicate.';
  }

  return respond(200, {
    supported: true,
    entityType,
    entityId,
    entityLabel: entity.label,
    companyId: entity.companyId,
    state: { status: entity.status, exchangeVisibility: entity.exchangeVisibility },
    actions,
    activeCases,
    caseCentreAvailable,
    caseCentreNote,
  });
}
