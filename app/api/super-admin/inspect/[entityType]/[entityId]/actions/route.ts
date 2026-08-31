import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const CASE_SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205']);
const POD_REVIEW_SCHEMA_UNAVAILABLE_CODES = new Set(['42703', 'PGRST204']);
const FINANCE_RECONCILIATION_SCHEMA_UNAVAILABLE_CODES = new Set(['42703', 'PGRST204']);
const ACTIVE_CASE_STATUSES = ['open', 'acknowledged', 'investigating', 'waiting'] as const;
const CASE_CAPABLE_ENTITY_TYPES = new Set(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute']);

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

type EntityState = {
  exists: boolean;
  label: string;
  companyId: string | null;
  status: string | null;
  exchangeVisibility: string | null;
};

const emptyEntity = (entityId: string): EntityState => ({
  exists: false,
  label: entityId,
  companyId: null,
  status: null,
  exchangeVisibility: null,
});

const isCaseSchemaUnavailable = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && CASE_SCHEMA_UNAVAILABLE_CODES.has(error.code));
const isPodReviewSchemaUnavailable = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(
    error
    && ((error.code && POD_REVIEW_SCHEMA_UNAVAILABLE_CODES.has(error.code))
      || error.message?.includes('platform_pod_review_status')),
  );
const isFinanceReconciliationSchemaUnavailable = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(
    error
    && ((error.code && FINANCE_RECONCILIATION_SCHEMA_UNAVAILABLE_CODES.has(error.code))
      || error.message?.includes('platform_finance_reconciliation_result')),
  );

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
    description: 'Create a high-priority platform investigation requiring urgent Platform Owner attention.',
    requiresReason: true,
    tone: 'warning',
    caseSeverity: 'P1',
  },
  {
    id: 'open_case_p2',
    label: 'Open P2 case',
    description: 'Create a standard platform exception investigation for this entity.',
    requiresReason: true,
    tone: 'primary',
    caseSeverity: 'P2',
  },
  {
    id: 'open_case_p3',
    label: 'Open P3 case',
    description: 'Create a lower-priority investigation for a non-urgent platform exception.',
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

const jsonArrayLength = (value: unknown) => Array.isArray(value) ? value.length : 0;
const signaturePresent = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(String(value).trim());
};

async function entityExists(entityType: string, entityId: string): Promise<EntityState> {
  if (!supabaseAdmin) return emptyEntity(entityId);

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

  if (entityType === 'company') {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, status')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.name ?? data.id) : entityId,
      companyId: data ? String(data.id) : null,
      status: data?.status ? String(data.status) : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'user') {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, company_id, status, role')
      .eq('user_id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (profile) {
      return {
        exists: true,
        label: String(profile.full_name ?? profile.user_id),
        companyId: profile.company_id ? String(profile.company_id) : null,
        status: profile.status ? String(profile.status) : null,
        exchangeVisibility: null,
      };
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(entityId);
    if (authError) {
      if (authError.status === 404) return emptyEntity(entityId);
      throw new Error(authError.message);
    }
    return {
      exists: Boolean(authUser.user),
      label: authUser.user?.email ?? entityId,
      companyId: null,
      status: authUser.user ? 'auth_identity' : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'driver') {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('id, display_name, full_name, name, company_id, status')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.display_name ?? data.full_name ?? data.name ?? data.id) : entityId,
      companyId: data?.company_id ? String(data.company_id) : null,
      status: data?.status ? String(data.status) : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'vehicle') {
    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .select('id, reg, registration, reg_plate, vehicle_reference, company_id, status, current_status')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.registration ?? data.reg_plate ?? data.reg ?? data.vehicle_reference ?? data.id) : entityId,
      companyId: data?.company_id ? String(data.company_id) : null,
      status: data ? String(data.current_status ?? data.status ?? '') : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'invoice') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, status, payment_status')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.invoice_number ?? data.id) : entityId,
      companyId: data?.company_id ? String(data.company_id) : null,
      status: data ? String(data.payment_status ?? data.status ?? '') : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'ticket') {
    const { data, error } = await supabaseAdmin
      .from('support_tickets')
      .select('id, subject, company_id, status, priority')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.subject ?? `Ticket ${data.id}`) : entityId,
      companyId: data?.company_id ? String(data.company_id) : null,
      status: data?.status ? String(data.status) : null,
      exchangeVisibility: null,
    };
  }

  if (entityType === 'dispute') {
    const { data, error } = await supabaseAdmin
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      exists: Boolean(data),
      label: data ? String(data.description ?? `Dispute ${data.id}`) : entityId,
      companyId: data?.raised_by_company_id ? String(data.raised_by_company_id) : null,
      status: data?.status ? String(data.status) : null,
      exchangeVisibility: null,
    };
  }

  return emptyEntity(entityId);
}

export async function GET(request: NextRequest, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { entityType: rawType, entityId: rawId } = await context.params;
  const entityType = decodeURIComponent(rawType).toLowerCase();
  const entityId = decodeURIComponent(rawId).trim();

  if (!CASE_CAPABLE_ENTITY_TYPES.has(entityType)) {
    return respond(200, {
      entityType,
      entityId,
      supported: false,
      actions: [],
      activeCases: [],
      caseCentreAvailable: null,
      domainNotes: ['No Platform Owner semantic action registry is defined for this entity type.'],
    });
  }

  let entity: EntityState;
  try {
    entity = await entityExists(entityType, entityId);
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Failed to resolve inspector action state.' });
  }
  if (!entity.exists) return respond(404, { error: `${entityType} entity not found.` });

  const actions: ActionDescriptor[] = [];
  const domainNotes: string[] = [];
  let podReviewState: Record<string, unknown> | null = null;
  let financeReconciliationState: Record<string, unknown> | null = null;

  if (entityType === 'job') {
    actions.push(...marketplaceActionsFor(entity.status ?? '', entity.exchangeVisibility ?? ''));
  }

  if (entityType === 'pod') {
    const podReview = await supabaseAdmin
      .from('jobs')
      .select('id, platform_pod_review_status, platform_pod_review_note, platform_pod_reviewed_at, delivery_signature_data, delivery_photos, pod_photos, hard_copy_pod')
      .eq('id', entityId)
      .maybeSingle();

    if (podReview.error) {
      if (!isPodReviewSchemaUnavailable(podReview.error)) return respond(500, { error: podReview.error.message });
      domainNotes.push('Platform POD review schema is not applied in this environment. POD review actions are suppressed.');
    } else if (podReview.data) {
      const deliveryPhotos = jsonArrayLength(podReview.data.delivery_photos);
      const podPhotos = jsonArrayLength(podReview.data.pod_photos);
      const hasSignature = signaturePresent(podReview.data.delivery_signature_data);
      const hasHardCopy = typeof podReview.data.hard_copy_pod === 'string' && podReview.data.hard_copy_pod.trim().length > 0;
      const hasPhysicalEvidence = hasSignature || deliveryPhotos > 0 || podPhotos > 0 || hasHardCopy;
      const reviewStatus = podReview.data.platform_pod_review_status ? String(podReview.data.platform_pod_review_status) : null;

      podReviewState = {
        available: true,
        reviewStatus,
        reviewNote: podReview.data.platform_pod_review_note,
        reviewedAt: podReview.data.platform_pod_reviewed_at,
        hasPhysicalEvidence,
        signaturePresent: hasSignature,
        deliveryPhotoCount: deliveryPhotos,
        podPhotoCount: podPhotos,
        hardCopyPresent: hasHardCopy,
      };

      if (hasPhysicalEvidence) {
        if (reviewStatus !== 'approved') {
          actions.push({ id: 'pod_approve', label: 'Approve POD', description: 'Approve the physical proof-of-delivery evidence under Platform Owner authority. A review reason is required and audited.', requiresReason: true, tone: 'primary' });
        }
        if (reviewStatus !== 'rejected') {
          actions.push({ id: 'pod_reject', label: 'Reject POD', description: 'Reject the submitted POD evidence as insufficient or invalid. A review reason is required and audited.', requiresReason: true, tone: 'danger' });
        }
      } else if (reviewStatus !== 'missing_requested') {
        actions.push({ id: 'pod_request_missing', label: 'Request missing POD', description: 'Record that physical POD evidence is missing and requires remediation. A review reason is required and audited.', requiresReason: true, tone: 'warning' });
      }
    }
  }

  if (entityType === 'invoice') {
    const reconciliation = await supabaseAdmin
      .from('invoices')
      .select('id, amount, payment_status, paid_at, platform_finance_reconciliation_result, platform_finance_reconciliation_note, platform_finance_reconciled_at')
      .eq('id', entityId)
      .maybeSingle();

    if (reconciliation.error) {
      if (!isFinanceReconciliationSchemaUnavailable(reconciliation.error)) return respond(500, { error: reconciliation.error.message });
      domainNotes.push('Platform finance reconciliation schema is not applied in this environment. Reconciliation actions are suppressed.');
    } else if (reconciliation.data) {
      if (!entity.companyId) return respond(409, { error: 'Invoice has no company authority boundary for reconciliation.' });
      const paymentHistory = await supabaseAdmin
        .from('invoice_payment_history')
        .select('amount, paid_at')
        .eq('invoice_id', entityId)
        .eq('company_id', entity.companyId)
        .order('paid_at', { ascending: false })
        .limit(500);
      if (paymentHistory.error) return respond(500, { error: paymentHistory.error.message });

      const invoiceAmount = Number(reconciliation.data.amount) || 0;
      const ledgerPaidAmount = (paymentHistory.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const expectedPaymentStatus = invoiceAmount > 0 && ledgerPaidAmount >= invoiceAmount
        ? 'paid'
        : ledgerPaidAmount > 0
          ? 'partially_paid'
          : 'unpaid';
      const currentPaymentStatus = String(reconciliation.data.payment_status ?? 'unpaid');
      const expectedPaidAt = expectedPaymentStatus === 'paid'
        ? (paymentHistory.data ?? []).map((row) => row.paid_at).filter(Boolean).sort().at(-1) ?? null
        : null;
      const currentPaidAt = reconciliation.data.paid_at ? String(reconciliation.data.paid_at) : null;
      const mismatch = currentPaymentStatus !== expectedPaymentStatus || currentPaidAt !== expectedPaidAt;

      financeReconciliationState = {
        available: true,
        invoiceAmount,
        ledgerPaidAmount,
        outstandingAmount: Math.max(0, invoiceAmount - ledgerPaidAmount),
        paymentRecordCount: (paymentHistory.data ?? []).length,
        currentPaymentStatus,
        expectedPaymentStatus,
        currentPaidAt,
        expectedPaidAt,
        mismatch,
        lastResult: reconciliation.data.platform_finance_reconciliation_result,
        lastNote: reconciliation.data.platform_finance_reconciliation_note,
        lastReconciledAt: reconciliation.data.platform_finance_reconciled_at,
      };

      actions.push({
        id: 'finance_reconcile_payment_status',
        label: mismatch ? 'Repair payment state' : 'Verify reconciliation',
        description: mismatch
          ? 'Recalculate invoice settlement state from invoice_payment_history and repair only the derived invoice payment state. No payment record is created.'
          : 'Recalculate invoice settlement state from invoice_payment_history and record an audited Platform Owner verification. No payment record is created.',
        requiresReason: true,
        tone: mismatch ? 'warning' : 'secondary',
      });
    }
  }

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
    state: {
      status: entity.status,
      exchangeVisibility: entity.exchangeVisibility,
      podReview: podReviewState,
      financeReconciliation: financeReconciliationState,
    },
    actions,
    activeCases,
    caseCentreAvailable,
    caseCentreNote,
    domainNotes,
  });
}
