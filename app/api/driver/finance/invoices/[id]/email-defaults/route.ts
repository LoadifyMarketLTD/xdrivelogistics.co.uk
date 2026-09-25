import { NextRequest, NextResponse } from 'next/server';

import {
  DEFAULT_INVOICE_EMAIL_MESSAGE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
} from '../../../../../../../lib/invoiceEmailTemplate';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const senderRoles = new Set(['owner', 'admin', 'dispatcher', 'finance']);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Invoice email defaults are temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Your session has expired. Sign in again.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Your session has expired. Sign in again.' });

  const { id } = await params;
  const { data: invoice, error: invoiceError } = await supabaseAdmin.from('invoices').select('id,company_id').eq('id', id).maybeSingle();
  if (invoiceError) return json(500, { error: 'Invoice email defaults could not be loaded.' });
  if (!invoice?.company_id) return json(404, { error: 'Invoice not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company,status')
    .eq('company_id', invoice.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json(500, { error: 'We could not verify company access.' });
  if (!membership || !senderRoles.has(String(membership.role_in_company ?? '').toLowerCase())) {
    return json(403, { error: 'Finance workspace role is required to view invoice email defaults.' });
  }

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
