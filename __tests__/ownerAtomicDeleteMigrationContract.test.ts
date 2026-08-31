import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830122049_repair_owner_job_delete_atomic_guard.sql'),
  'utf8',
);
const runtimeValidation = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830122404_verify_owner_job_delete_atomic_guard_runtime.sql'),
  'utf8',
);

describe('atomic owner delete migration contract', () => {
  it('reconstructs the current server-only Owner Job dependency tables on a clean database', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.proof_of_delivery');
    expect(migration).toContain('job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE');
    expect(migration).toContain("delivery_status text NOT NULL DEFAULT 'Completed Delivery'");
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_pod_job_id');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_pod_created_by');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.job_cancellation_requests');
    expect(migration).toContain('job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT');
    expect(migration).toContain("requester_party text NOT NULL CHECK (requester_party IN ('load_owner', 'carrier'))");
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS job_cancellation_requests_job_created_idx');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS job_cancellation_requests_one_pending_idx');
  });

  it('keeps both dependency tables raw-client closed and service-role available', () => {
    expect(migration).toContain('ALTER TABLE public.proof_of_delivery ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.proof_of_delivery FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT ALL ON TABLE public.proof_of_delivery TO service_role');
    expect(migration).toContain('ALTER TABLE public.job_cancellation_requests ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.job_cancellation_requests FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT ALL ON TABLE public.job_cancellation_requests TO service_role');
    expect(migration).toContain('Owner Job dependency tables unexpectedly expose raw client reads.');
  });

  it('restores the hosted POD updated-at trigger without exposing its helper', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.update_updated_at_column()');
    expect(migration).toContain('NEW.updated_at = NOW()');
    expect(migration).toContain('CREATE TRIGGER pod_updated_at');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated');
  });

  it('locks the job row and rejects non pre-award lifecycle drift', () => {
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("v_status NOT IN ('draft', 'received', 'posted')");
    expect(migration).toContain("v_current_status NOT IN ('draft', 'received', 'posted')");
  });

  it('rechecks bids, execution history, documents and progressed stops inside the transaction', () => {
    for (const table of [
      'job_bids',
      'job_commercial_agreements',
      'proof_of_delivery',
      'invoices',
      'job_disputes',
      'job_cancellation_requests',
      'invoice_disputes',
      'quotes',
      'reviews',
      'job_documents',
      'documents',
      'job_stops',
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
  });

  it('uses the current jobs-only schema and never references removed loads.job_id', () => {
    expect(migration).toContain('DELETE FROM public.jobs');
    expect(migration).not.toContain('DELETE FROM public.loads');
    expect(migration).not.toContain('loads.job_id');
  });

  it('writes a durable audit entry and stays service-role only', () => {
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'workspace_owner_delete'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) FROM authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) TO service_role');
  });

  it('retains the hosted synthetic success-path validation without leaving test data', () => {
    expect(runtimeValidation).toContain("exchange_visibility,\n      is_test,\n      customer_ref");
    expect(runtimeValidation).toContain("'private',\n      true,");
    expect(runtimeValidation).toContain('delete_unbid_exchange_job_atomic(v_job_id, v_actor_user_id)');
    expect(runtimeValidation).toContain("action_type = 'exchange_load_deleted_without_bids'");
    expect(runtimeValidation).toContain("ERRCODE = 'PZ001'");
    expect(runtimeValidation).toContain('Synthetic audit record remained after validation rollback.');
  });

  it('does not block clean migration replay before account seed data exists', () => {
    expect(runtimeValidation).toContain('IF v_actor_user_id IS NULL OR v_company_id IS NULL THEN');
    expect(runtimeValidation).toContain('RETURN;');
    expect(runtimeValidation).not.toContain('validation requires an active posting-company operator');
  });
});
