import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const rpc = read('supabase/migrations/20260816102000_restore_canonical_driver_execution_lifecycle.sql');
const reconciliation = read('supabase/migrations/20260819145500_reconcile_pr357_driver_execution_schema.sql');
const legacyStatusSync = read('supabase/migrations/20260819153000_sync_legacy_job_status_into_current_status.sql');
const finalReplayReconciliation = read('supabase/migrations/20260819154000_remove_legacy_accepted_bid_assignment_trigger.sql');

const sequence = [
  'on_my_way',
  'on_site_pickup',
  'loaded',
  'in_transit',
  'on_site_delivery',
  'delivered',
  'completed',
];

describe('PR357 Driver execution schema reconciliation', () => {
  it('keeps the existing canonical Driver RPC as the lifecycle authority', () => {
    for (const status of sequence) {
      expect(rpc).toContain(`'${status}'`);
      expect(reconciliation).toContain(`'${status}'`);
    }

    expect(reconciliation).toContain('DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs');
    expect(reconciliation).toContain('CREATE TRIGGER trg_jobs_mvp_guardrails');
  });

  it('materialises only runtime fields already consumed by PR357 execution and award paths', () => {
    for (const column of [
      'current_status',
      'assigned_company_id',
      'accepted_bid_id',
      'pod_photos',
      'pod_generated',
      'pod_generated_at',
      'on_my_way_at',
      'on_site_pickup_at',
      'loaded_at',
      'on_site_delivery_at',
      'delivered_at',
      'completed_at',
      'status_updated_at',
      'event_time',
      'user_id',
    ]) expect(reconciliation).toContain(column);
  });

  it('converges POD evidence to the JSONB contract used by the current RPC without inventing stricter live defaults', () => {
    expect(reconciliation).toContain('ALTER COLUMN delivery_photos TYPE jsonb');
    expect(reconciliation).toContain('ALTER COLUMN delivery_signature_data TYPE jsonb');
    expect(reconciliation).toContain('ALTER COLUMN pod_photos DROP DEFAULT');
    expect(reconciliation).toContain('ALTER COLUMN pod_photos DROP NOT NULL');
    expect(reconciliation).not.toContain("pod_photos jsonb NOT NULL DEFAULT '[]'::jsonb");
    expect(reconciliation).toContain("jsonb_array_length(COALESCE(NEW.delivery_photos, '[]'::jsonb))");
    expect(reconciliation).toContain("NEW.delivery_signature_data #>> '{}'");
  });

  it('aligns fresh enum-backed execution columns to the proven live text/default contract', () => {
    expect(reconciliation).toContain("v_status_udt_name = 'job_status'");
    expect(reconciliation).toContain('ALTER COLUMN status TYPE text USING status::text');
    expect(reconciliation).toContain("ALTER COLUMN status SET DEFAULT 'open'::text");
    expect(reconciliation).toContain("v_event_udt_name = 'tracking_event_type'");
    expect(reconciliation).toContain('ALTER COLUMN event_type TYPE text USING event_type::text');
    expect(reconciliation).toContain('ADD COLUMN IF NOT EXISTS event_time timestamptz NOT NULL DEFAULT now()');
    expect(reconciliation).toContain('ALTER COLUMN event_time SET NOT NULL');
  });

  it('keeps direct legacy status writers aligned with canonical execution without importing Finance aliases', () => {
    expect(legacyStatusSync).toContain('NEW.status IS NOT DISTINCT FROM OLD.status');
    expect(legacyStatusSync).toContain('NEW.current_status IS DISTINCT FROM OLD.current_status');
    expect(legacyStatusSync).toContain("WHEN 'collected' THEN 'loaded'");
    expect(legacyStatusSync).toContain("WHEN 'delivered' THEN 'delivered'");
    expect(legacyStatusSync).toContain("WHEN 'cancelled' THEN 'cancelled'");
    expect(legacyStatusSync).not.toContain("WHEN 'invoiced' THEN");
    expect(legacyStatusSync).not.toContain("WHEN 'paid' THEN");
    expect(legacyStatusSync).toContain('NEW.current_status := v_execution_status');
  });

  it('does not rewrite historical jobs while installing the legacy-writer backstop', () => {
    expect(legacyStatusSync).not.toContain('UPDATE public.jobs');
    expect(legacyStatusSync).toContain('CREATE TRIGGER trg_jobs_legacy_status_current_status_sync');
  });

  it('reconciles only live-proven Driver identity fields that clean history omitted', () => {
    expect(finalReplayReconciliation).toContain("column_name = 'is_active'");
    expect(finalReplayReconciliation).toContain('ADD COLUMN is_active boolean NOT NULL DEFAULT true');
    expect(finalReplayReconciliation).toContain("column_name = 'name'");
    expect(finalReplayReconciliation).toContain('ADD COLUMN name text');
    expect(finalReplayReconciliation).toContain("column_name = 'full_name'");
    expect(finalReplayReconciliation).toContain('ADD COLUMN full_name text');
    expect(finalReplayReconciliation).toContain('IF NOT v_had_name THEN');
    expect(finalReplayReconciliation).toContain('IF NOT v_had_full_name THEN');
  });

  it('repairs stale replayed functions without changing their authority boundaries', () => {
    expect(finalReplayReconciliation).toContain('CREATE OR REPLACE FUNCTION public.safe_dedup_drivers');
    expect(finalReplayReconciliation).not.toContain('d.first_name');
    expect(finalReplayReconciliation).not.toContain('d.last_name');
    expect(finalReplayReconciliation).not.toContain('v_dup.first_name');
    expect(finalReplayReconciliation).not.toContain('v_dup.last_name');
    expect(finalReplayReconciliation).toContain('v_dup.driver_name');

    expect(finalReplayReconciliation).toContain("to_regprocedure('public.submit_onboarding_application_base_v1(uuid)')");
    expect(finalReplayReconciliation).toContain("replace(v_def, 'v_role text;', 'v_role public.company_role;')");
    expect(finalReplayReconciliation).toContain('REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated');

    expect(finalReplayReconciliation).toContain('CREATE OR REPLACE FUNCTION public.set_company_status_governance');
    expect(finalReplayReconciliation).toContain('SELECT format_type(a.atttypid, a.atttypmod)');
    expect(finalReplayReconciliation).not.toContain("SET status = $1::company_status");
    expect(finalReplayReconciliation).toContain("'UPDATE public.companies SET status = $1::%s WHERE id = $2'");
  });

  it('keeps the remote-only accepted-bid assignment bypass disabled', () => {
    expect(finalReplayReconciliation).toContain('DROP TRIGGER IF EXISTS trg_sync_job_assignment_from_accepted_bid ON public.jobs');
    expect(finalReplayReconciliation).not.toContain('CREATE TRIGGER trg_sync_job_assignment_from_accepted_bid');
  });

  it('does not change invoice creation or the legacy invoice sync trigger in this lifecycle slice', () => {
    expect(reconciliation).not.toContain('CREATE TRIGGER trg_sync_job_status_from_invoice');
    expect(reconciliation).not.toContain('DROP TRIGGER IF EXISTS trg_sync_job_status_from_invoice');
    expect(reconciliation).not.toContain('INSERT INTO public.invoices');
    expect(reconciliation).not.toContain('UPDATE public.invoices');
  });

  it('does not alter workspace UI, RLS, award RPCs or bidder schema', () => {
    expect(reconciliation).not.toContain('CREATE POLICY');
    expect(reconciliation).not.toContain('DROP POLICY');
    expect(reconciliation).not.toContain('accept_job_bid_atomic');
    expect(reconciliation).not.toContain('bidder_company_id');
    expect(reconciliation).not.toContain('roleCapabilities');

    expect(finalReplayReconciliation).not.toContain('CREATE POLICY');
    expect(finalReplayReconciliation).not.toContain('DROP POLICY');
    expect(finalReplayReconciliation).not.toContain('INSERT INTO public.invoices');
    expect(finalReplayReconciliation).not.toContain('UPDATE public.invoices');
    expect(finalReplayReconciliation).not.toContain('roleCapabilities');
  });
});
