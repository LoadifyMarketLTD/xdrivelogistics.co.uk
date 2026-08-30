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
});
