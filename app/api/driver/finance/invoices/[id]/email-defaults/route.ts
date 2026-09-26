import { NextRequest, NextResponse } from 'next/server';

import {
  DEFAULT_INVOICE_EMAIL_MESSAGE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
} from '../../../../../../../lib/invoiceEmailTemplate';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { requireDriverFinanceAccess } from '../../../_lib/financeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Invoice email defaults are temporarily unavailable.' });
  const access = await requireDriverFinanceAccess(request);
  if (!access.ok) return access.response;

  const { id } = await params;
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id,company_id')
    .eq('id', id)
    .eq('company_id', access.context.companyId)
    .maybeSingle();
  if (invoiceError) return json(500, { error: 'Invoice email defaults could not be loaded.' });
  if (!invoice?.company_id) return json(404, { error: 'Invoice not found.' });

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('company_settings')
    .select('invoice_email_subject_template,invoice_email_message_template')
    .eq('company_id', invoice.company_id)
    .maybeSingle();
  if (settingsError) return json(500, { error: 'Invoice email defaults could not be loaded.' });

  return json(200, {
    subject: typeof settings?.invoice_email_subject_template === 'string' && settings.invoice_email_subject_template.trim()
      ? settings.invoice_email_subject_template.trim()
      : DEFAULT_INVOICE_EMAIL_SUBJECT,
    message: typeof settings?.invoice_email_message_template === 'string' && settings.invoice_email_message_template.trim()
      ? settings.invoice_email_message_template.trim()
      : DEFAULT_INVOICE_EMAIL_MESSAGE,
  });
}
