import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205', '42883']);

const patchSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

const isSchemaUnavailable = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(
    error
    && ((error.code && SCHEMA_UNAVAILABLE_CODES.has(error.code))
      || error.message?.includes('platform_finance_reconciliations')
      || error.message?.includes('owner_reconcile_invoice_payment_status')),
  );

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { invoiceId } = await params;
  const invoiceResult = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, company_id, client_name, amount, currency, status, payment_status, paid_at, invoice_date, due_date, created_at, updated_at')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceResult.error) return respond(500, { error: invoiceResult.error.message });
  if (!invoiceResult.data) return respond(404, { error: 'Invoice not found.' });

  const paymentResult = await supabaseAdmin
    .from('invoice_payment_history')
    .select('id, company_id, invoice_id, amount, currency, settlement_method, external_reference, note, paid_at, created_at')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true });

  if (paymentResult.error) return respond(500, { error: paymentResult.error.message });

  const reconciliationResult = await supabaseAdmin
    .from('platform_finance_reconciliations')
    .select('result, note, reconciled_by, reconciled_at, reconciliation_snapshot, updated_at')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  if (reconciliationResult.error) {
    if (isSchemaUnavailable(reconciliationResult.error)) {
      return respond(503, {
        error: 'Platform finance reconciliation schema is not applied in this environment.',
        migrationRequired: '20260902085000_platform_finance_reconciliation.sql',
      });
    }
    return respond(500, { error: reconciliationResult.error.message });
  }

  const invoice = invoiceResult.data;
  const payments = paymentResult.data ?? [];
  const invoiceCurrency = String(invoice.currency ?? '').trim().toUpperCase();
  const companyMismatchCount = payments.filter((row) => row.company_id !== invoice.company_id).length;
  const currencyMismatchCount = payments.filter(
    (row) => String(row.currency ?? '').trim().toUpperCase() !== invoiceCurrency,
  ).length;
  const ledgerPaidAmount = payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  return respond(200, {
    previewReadOnly: isSuperAdminDeployPreviewReadOnly(),
    invoice,
    ledger: {
      payments,
      paymentRecordCount: payments.length,
      ledgerPaidAmount,
      companyMismatchCount,
      currencyMismatchCount,
      integrityOk: companyMismatchCount === 0 && currencyMismatchCount === 0 && invoiceCurrency.length > 0,
    },
    platformReconciliation: reconciliationResult.data ? {
      result: reconciliationResult.data.result,
      note: reconciliationResult.data.note,
      reconciledBy: reconciliationResult.data.reconciled_by,
      reconciledAt: reconciliationResult.data.reconciled_at,
      snapshot: reconciliationResult.data.reconciliation_snapshot,
      updatedAt: reconciliationResult.data.updated_at,
    } : null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) {
      return respond(403, { error: 'Deploy Preview is read-only. Finance reconciliation was not changed.' });
    }
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid invoice reconciliation payload.',
      details: parsed.error.flatten(),
    });
  }

  const { invoiceId } = await params;
  const { data, error } = await supabaseAdmin.rpc('owner_reconcile_invoice_payment_status', {
    p_actor_user_id: owner.id,
    p_invoice_id: invoiceId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (isSchemaUnavailable(error)) {
      return respond(503, {
        error: 'Platform finance reconciliation schema is not applied in this environment.',
        migrationRequired: '20260902085000_platform_finance_reconciliation.sql',
      });
    }
    if (error.code === 'P0002') return respond(404, { error: error.message });
    if (error.code === '23514' || error.code === '23502') return respond(409, { error: error.message });
    if (error.code === '42501') return respond(403, { error: error.message });
    return respond(500, { error: error.message });
  }

  return respond(200, {
    success: true,
    reconciliation: Array.isArray(data) ? data[0] ?? null : data,
  });
}
