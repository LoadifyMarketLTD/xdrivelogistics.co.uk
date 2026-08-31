import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-09 Platform Owner finance reconciliation', () => {
  it('reconciles derived settlement state from the canonical payment ledger only', () => {
    const migration = readRepoFile('supabase/migrations/20260831015000_platform_finance_reconciliation.sql');

    expect(migration).toContain('owner_reconcile_invoice_payment_status');
    expect(migration).toContain('FROM public.invoice_payment_history ph');
    expect(migration).toContain('public.fn_calculate_invoice_payment_status');
    expect(migration).not.toContain('INSERT INTO public.invoice_payment_history');
  });

  it('requires active Platform Owner authority, reason and durable audit provenance', () => {
    const migration = readRepoFile('supabase/migrations/20260831015000_platform_finance_reconciliation.sql');

    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('A reconciliation reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'finance_invoice_reconciled'");
    expect(migration).toContain("'finance_invoice_reconciliation_verified'");
    expect(migration).toContain("'source', 'invoice_payment_history'");
  });

  it('stores explicit reconciliation provenance without overwriting tenant settlement records', () => {
    const migration = readRepoFile('supabase/migrations/20260831015000_platform_finance_reconciliation.sql');

    expect(migration).toContain('platform_finance_reconciliation_result');
    expect(migration).toContain('platform_finance_reconciliation_note');
    expect(migration).toContain('platform_finance_reconciled_by');
    expect(migration).toContain('platform_finance_reconciled_at');
    expect(migration).toContain("IN ('verified', 'corrected')");
  });

  it('uses an owner-gated semantic API rather than generic invoice field mutation', () => {
    const route = readRepoFile('app/api/super-admin/finance/invoices/[invoiceId]/reconcile/route.ts');

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("supabaseAdmin.rpc('owner_reconcile_invoice_payment_status'");
    expect(route).not.toContain(".from('invoices').update(");
    expect(route).not.toContain('field');
    expect(route).not.toContain('value');
  });

  it('suppresses reconciliation controls when the branch-only schema is absent', () => {
    const actionsRoute = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');

    expect(actionsRoute).toContain('FINANCE_RECONCILIATION_SCHEMA_UNAVAILABLE_CODES');
    expect(actionsRoute).toContain('Platform finance reconciliation schema is not applied in this environment. Reconciliation actions are suppressed.');
    expect(actionsRoute).toContain("id: 'finance_reconcile_payment_status'");
  });

  it('shows invoice-vs-ledger state and reloads after a reconciliation', () => {
    const page = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');

    expect(page).toContain('FinanceReconciliationSummary');
    expect(page).toContain("entityTypeParam === 'invoice' && descriptor.id === 'finance_reconcile_payment_status'");
    expect(page).toContain('/api/super-admin/finance/invoices/${encodeURIComponent(entityIdParam)}/reconcile');
    expect(page).toContain("caseSource = entityTypeParam === 'invoice' ? 'finance' : 'operations'");
    expect(page).toContain('await load();');
  });
});
