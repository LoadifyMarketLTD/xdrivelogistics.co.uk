import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260902085000_platform_finance_reconciliation.sql';
const ROUTE = 'app/api/super-admin/finance/invoices/[invoiceId]/reconcile/route.ts';
const PAGE = 'app/super-admin/finance/invoices/[invoiceId]/page.tsx';
const LIST = 'app/super-admin/finance/invoices/page.tsx';

describe('Platform Owner finance reconciliation', () => {
  it('isolates internal reconciliation provenance from tenant-visible invoices', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_finance_reconciliations');
    expect(migration).not.toContain('ADD COLUMN IF NOT EXISTS platform_finance_reconciliation');
    expect(migration).not.toContain('platform_finance_reconciliation_note text');
  });

  it('keeps the internal registry and mutation service-role only', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('ALTER TABLE public.platform_finance_reconciliations ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.platform_finance_reconciliations FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_finance_reconciliations TO service_role');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) TO service_role');
  });

  it('fails closed on ledger company or currency mismatch', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('Payment ledger company mismatch detected; reconciliation refused.');
    expect(migration).toContain('Payment ledger currency mismatch detected; reconciliation refused.');
    expect(migration).toContain("NULLIF(upper(btrim(i.currency)), '')");
    expect(migration).toContain('upper(btrim(ph.currency)) IS DISTINCT FROM v_invoice_currency');
  });

  it('does not fabricate or mutate payment history records', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).not.toContain('INSERT INTO public.invoice_payment_history');
    expect(migration).not.toContain('UPDATE public.invoice_payment_history');
    expect(migration).not.toContain('DELETE FROM public.invoice_payment_history');
    expect(migration).toContain('IF v_changed THEN\n    UPDATE public.invoices');
    expect(migration).toContain('payment_status = v_expected_payment_status');
    expect(migration).toContain('paid_at = v_expected_paid_at');
  });

  it('uses active Platform Owner authority, reason and durable audit', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('A reconciliation reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'authority', 'platform_owner'");
    expect(migration).toContain("'source', 'invoice_payment_history'");
  });

  it('keeps auth account lifecycle from being blocked by reconciliation provenance', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL');
    expect(migration).toContain('idx_platform_finance_reconciliations_reconciled_by');
  });

  it('uses a dedicated owner-gated API and preview fail-closed mutation path', () => {
    const route = readRepoFile(ROUTE);

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain('isSuperAdminDeployPreviewReadOnly()');
    expect(route).toContain("supabaseAdmin.rpc('owner_reconcile_invoice_payment_status'");
    expect(route).toContain(".from('platform_finance_reconciliations')");
    expect(route).toContain('Deploy Preview is read-only. Finance reconciliation was not changed.');
  });

  it('exposes reconciliation from Finance without replacing the existing invoice ledger', () => {
    const page = readRepoFile(PAGE);
    const list = readRepoFile(LIST);

    expect(page).toContain('/api/super-admin/finance/invoices/${encodeURIComponent(invoiceId)}/reconcile');
    expect(page).toContain('Payment ledger');
    expect(page).toContain('Ledger integrity');
    expect(page).toContain('Verify against payment ledger');
    expect(list).toContain('/super-admin/finance/invoices/${encodeURIComponent(row.id)}');
    expect(list).toContain('Reconcile →');
    expect(list).toContain('/api/super-admin/finance?section=invoices&limit=250');
  });
});
