import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813095000_atomic_delivered_invoice_draft.sql'),
  'utf8',
);

const androidCompatMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813093000_android_native_pod_compat.sql'),
  'utf8',
);

describe('Delivered -> Invoice Draft lifecycle invariant', () => {
  it('installs a client-independent trigger on job delivery status changes', () => {
    expect(migration).toContain('CREATE TRIGGER trg_ensure_delivered_invoice_draft');
    expect(migration).toContain('AFTER UPDATE OF status, current_status ON public.jobs');
    expect(migration).toContain('PERFORM public.ensure_delivered_invoice_draft(NEW.id, auth.uid());');
  });

  it('fails closed unless POD, canonical job ref and accepted carrier agreement are valid', () => {
    expect(migration).toContain('IF NOT public.is_job_pod_valid(p_job_id) THEN');
    expect(migration).toContain("nullif(btrim(coalesce(v_job.customer_ref, '')), '') IS NULL");
    expect(migration).toContain("lower(coalesce(a.agreement_status, '')) = 'accepted'");
    expect(migration).toContain('a.supplier_company_id = v_job.awarded_carrier_company_id');
  });

  it('creates one issuer-owned Draft using the accepted agreement buyer and supplier', () => {
    expect(migration).toContain("'draft'::public.invoice_status");
    expect(migration).toContain("'marketplace'");
    expect(migration).toContain('v_agreement.buyer_company_id');
    expect(migration).toContain('v_agreement.supplier_company_id');
    expect(migration).toContain("'auto-pod-' || p_job_id::text");
    expect(migration).toContain('i.commercial_agreement_id = v_agreement.id');
  });

  it('snapshots canonical job and POD provenance into the Draft', () => {
    expect(migration).toContain('v_job.customer_ref');
    expect(migration).toContain('to_jsonb(v_pod_paths)');
    expect(migration).toContain('v_pod.signature_url');
    expect(migration).toContain('v_pod.received_by');
    expect(migration).toContain('coalesce(v_pod.completed_at, now())');
  });

  it('covers Android native because its delivered RPC updates job status in the same transaction', () => {
    expect(androidCompatMigration).toContain('UPDATE public.jobs j');
    expect(androidCompatMigration).toContain('SET status = v_next_status');
    expect(androidCompatMigration).toContain("WHEN 'delivered' THEN 'delivered_at'");
    expect(androidCompatMigration).toContain('IF NOT public.is_job_pod_valid(p_job_id) THEN');
  });
});
