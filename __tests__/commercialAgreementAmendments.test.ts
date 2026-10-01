import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926155130_commercial_agreement_amendments.sql'), 'utf8');
const applyMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20261001145737_apply_accepted_job_amendments.sql'), 'utf8');
const amendmentsApi = readFileSync(join(process.cwd(), 'app/api/workspace/jobs/[jobId]/amendments/route.ts'), 'utf8');
const decisionApi = readFileSync(join(process.cwd(), 'app/api/workspace/jobs/[jobId]/amendments/[amendmentId]/decision/route.ts'), 'utf8');
const autoInvoice = readFileSync(join(process.cwd(), 'app/api/_lib/autoGenerateMarketplaceInvoice.ts'), 'utf8');
const driverInvoice = readFileSync(join(process.cwd(), 'app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts'), 'utf8');
const workspaceSheet = readFileSync(join(process.cwd(), 'app/api/workspace/jobs/[jobId]/sheet/route.ts'), 'utf8');
const mobileAmendments = readFileSync(join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/amendments/route.ts'), 'utf8');
const amendmentControls = readFileSync(join(process.cwd(), 'app/components/workspace/CommercialAmendmentControls.tsx'), 'utf8');
const notifyOperationalEvent = readFileSync(join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');

describe('commercial agreement amendment/versioning contract', () => {
  it('creates append-only versioned amendments without mutating the original agreement', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.job_commercial_agreement_amendments');
    expect(migration).toContain('version_number integer NOT NULL CHECK (version_number >= 2)');
    expect(migration).toContain('job_commercial_agreement_amendments_one_open');
    expect(migration).toContain("WHERE status = 'proposed'");
    expect(migration).toContain('Commercial amendment proposal content is immutable.');
    expect(migration).toContain('Commercial amendment records are append-only and cannot be deleted.');
    expect(migration).not.toMatch(/UPDATE\s+public\.job_commercial_agreements\s+SET/i);
  });

  it('derives the contractual counterparty and blocks self-acceptance at the database boundary', () => {
    expect(migration).toContain('NEW.counterparty_company_id := v_agreement.supplier_company_id');
    expect(migration).toContain('NEW.counterparty_company_id := v_agreement.buyer_company_id');
    expect(migration).toContain("NEW.status IN ('accepted','rejected') AND NEW.decided_by_company_id <> OLD.counterparty_company_id");
    expect(migration).toContain("NEW.status = 'cancelled' AND NEW.decided_by_company_id <> OLD.proposed_by_company_id");
  });

  it('blocks material amendments after invoicing or job closure', () => {
    expect(migration).toContain('cannot be materially amended after invoicing');
    expect(migration).toContain('cannot be materially amended after the job is closed');
    expect(migration).toContain('Commercial amendment cannot be accepted after invoicing');
    expect(migration).toContain('Commercial amendment cannot be accepted after the job is closed');
  });

  it('exposes a canonical effective agreement view with the latest accepted version', () => {
    expect(migration).toContain('CREATE VIEW public.job_commercial_agreements_effective');
    expect(migration).toContain("amendment.status = 'accepted'");
    expect(migration).toContain('ORDER BY amendment.version_number DESC');
    expect(migration).toContain('COALESCE(amendment.version_number, 1) AS contract_version');
    expect(migration).toContain('COALESCE(amendment.effective_snapshot_hash, agreement.contract_snapshot_hash) AS contract_snapshot_hash');
  });

  it('moves marketplace invoice generation and integrity validation onto effective terms', () => {
    expect(migration).toContain('FROM public.job_commercial_agreements_effective agreement');
    expect(migration).toContain('FROM public.job_commercial_agreements_effective');
    expect(autoInvoice).toContain(".from('job_commercial_agreements_effective')");
    expect(driverInvoice).toContain(".from('job_commercial_agreements_effective')");
    expect(workspaceSheet).toContain("from('job_commercial_agreements_effective')");
  });

  it('requires an authorised contractual company and a real change to propose', () => {
    expect(amendmentsApi).toContain("const DECISION_ROLES = new Set(['owner', 'admin', 'dispatcher'])");
    expect(amendmentsApi).toContain('At least one contractual change is required.');
    expect(amendmentsApi).toContain('The proposal does not change the current effective contract.');
    expect(amendmentsApi).toContain('Choose which contractual company you are acting for.');
    expect(amendmentsApi).toContain(".from('job_commercial_agreements_effective')");
  });

  it('allows counterparty management or the exact assigned driver to accept/reject', () => {
    expect(decisionApi).toContain("parsed.data.action === 'cancel'");
    expect(decisionApi).toContain('amendment.counterparty_company_id');
    expect(decisionApi).toContain(".select('assigned_driver_id,awarded_carrier_company_id,assigned_company_id')");
    expect(decisionApi).toContain(".eq('id', assignedDriverId)");
    expect(decisionApi).toContain(".eq('user_id', auth.user.id)");
    expect(decisionApi).toContain('Only the assigned driver or an authorised member of the contractual counterparty may accept or reject this amendment.');
    expect(decisionApi).toContain('Only an authorised member of the proposing company may cancel this amendment.');
    expect(decisionApi).toContain(".eq('status', 'proposed')");
  });

  it('records proposal and decision events without making messages contractual mutations', () => {
    expect(amendmentsApi).toContain("event_type: 'commercial_amendment_proposed'");
    expect(decisionApi).toContain('commercial_amendment_${nextStatus}');
  });

  it('records the poster verbal-agreement declaration but still requires app acceptance', () => {
    expect(amendmentsApi).toContain('verbalAgreementConfirmed');
    expect(amendmentsApi).toContain('summary.verbalAgreement');
    expect(amendmentControls).toContain('Carrier / assigned driver verbally agreed to these proposed changes.');
    expect(amendmentControls).toContain('App acceptance is still required before this change becomes active.');
    expect(amendmentControls).toContain('Send for Acceptance');
  });

  it('exposes pending amendments to the assigned native driver and records accept/reject', () => {
    expect(mobileAmendments).toContain(".eq('assigned_driver_id', driverId)");
    expect(mobileAmendments).toContain("if (!['accept', 'reject'].includes(action))");
    expect(mobileAmendments).toContain("String(amendment.counterparty_company_id ?? '') !== executionCompanyId");
    expect(mobileAmendments).toContain("decided_by_user_id: driver.userId");
    expect(mobileAmendments).toContain("event_type: 'commercial_amendment_' + nextStatus");
    expect(mobileAmendments).toContain('recipient_user_id: amendment.proposed_by_user_id');
    expect(amendmentControls).toContain('Accept Changes');
    expect(amendmentControls).toContain('Reject Changes');
  });

  it('records explicit OLD to NEW field deltas and price adjustments for the audit trail', () => {
    expect(amendmentsApi).toContain('describeJobPatch');
    expect(amendmentsApi).toContain('summary.jobChanges = jobChanges');
    expect(amendmentsApi).toContain("summary.agreedAmount = { from: currentAmount, to: nextAmount }");
    expect(amendmentControls).toContain('change.from');
    expect(amendmentControls).toContain('change.to');
    expect(amendmentControls).toContain('Price adjustment:');
  });

  it('applies accepted amendments to the operational job only after acceptance', () => {
    expect(applyMigration).toContain('CREATE OR REPLACE FUNCTION public.fn_apply_accepted_job_amendment()');
    expect(applyMigration).toContain("NEW.status <> 'accepted'");
    expect(applyMigration).toContain("OLD.status = 'accepted'");
    expect(applyMigration).toContain('UPDATE public.jobs');
    expect(applyMigration).toContain('UPDATE public.job_stops');
  });

  it('queues amendment notifications and supports assigned-driver push delivery', () => {
    expect(amendmentsApi).toContain("event_type: 'commercial_amendment_proposed'");
    expect(amendmentsApi).toContain(".from('notification_events').insert");
    expect(amendmentsApi).toContain('recipient_user_id: assignedDriverUserId');
    expect(decisionApi).toContain(".from('notification_events').insert");
    expect(decisionApi).toContain('recipient_user_id: amendment.proposed_by_user_id');
    expect(notifyOperationalEvent).toContain('async function handleCommercialAmendment');
    expect(notifyOperationalEvent).toContain("'Job Change Requires Acceptance'");
    expect(notifyOperationalEvent).toContain("case 'commercial_amendment_proposed':");
    expect(notifyOperationalEvent).toContain("case 'commercial_amendment_accepted':");
    expect(notifyOperationalEvent).toContain("case 'commercial_amendment_rejected':");
  });
});
