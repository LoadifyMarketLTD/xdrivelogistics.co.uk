import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830122500_repair_owner_job_delete_atomic_guard.sql'),
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
});
