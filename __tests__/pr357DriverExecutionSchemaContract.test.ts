import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const rpc = read('supabase/migrations/20260816102000_restore_canonical_driver_execution_lifecycle.sql');
const reconciliation = read('supabase/migrations/20260819145500_reconcile_pr357_driver_execution_schema.sql');

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

  it('converges POD evidence to the JSONB contract used by the current RPC', () => {
    expect(reconciliation).toContain('ALTER COLUMN delivery_photos TYPE jsonb');
    expect(reconciliation).toContain('ALTER COLUMN delivery_signature_data TYPE jsonb');
    expect(reconciliation).toContain("jsonb_array_length(COALESCE(NEW.delivery_photos, '[]'::jsonb))");
    expect(reconciliation).toContain("NEW.delivery_signature_data #>> '{}'");
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
  });
});
