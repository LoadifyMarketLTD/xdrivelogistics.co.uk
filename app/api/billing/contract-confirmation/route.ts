import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { COMPANY_CONFIG } from '../../../config/company';
import { XDRIVE_STANDARD_PLANS, isStandardMembershipPlan } from '../../../../lib/commercialBilling';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const COMPANY_BILLING_ROLES = new Set(['owner', 'admin']);
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const formatDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
  : 'Not available';
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return fail(503, 'Server auth is not configured.');
  const token = getBearerToken(request);
  if (!token) return fail(401, 'Unauthorized.');
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return fail(401, 'Unauthorized.');

  const companyIdParam = request.nextUrl.searchParams.get('companyId');
  const companyId = companyIdParam && /^[0-9a-f-]{36}$/i.test(companyIdParam) ? companyIdParam : null;

  if (companyId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return fail(500, membershipError.message);
    if (!membership || !COMPANY_BILLING_ROLES.has(String(membership.role_in_company ?? '').toLowerCase())) {
      return fail(403, 'Only a company owner or admin can download the membership contract confirmation.');
    }
  }

  let query = supabaseAdmin.from('platform_membership_subscriptions')
    .select('id, company_id, plan_id, status, trial_started_at, trial_ends_at, current_period_end, stripe_subscription_id, contract_terms_version, contract_accepted_at, created_at');
  query = companyId
    ? query.eq('company_id', companyId)
    : query.eq('user_id', authData.user.id).is('company_id', null);
  const { data: subscription, error } = await query.maybeSingle();
  if (error && ['PGRST205', '42P01'].includes(error.code ?? '')) return fail(503, 'Membership billing schema is not available yet.');
  if (error) return fail(500, error.message);
  if (!subscription) return fail(404, 'No membership contract was found.');
  if (!subscription.contract_accepted_at) return fail(409, 'Membership terms have not been accepted.');
  if (!isStandardMembershipPlan(subscription.plan_id)) return fail(409, 'This membership is not a standard self-service plan.');

  let accountName = authData.user.email ?? 'XDrive account holder';
  if (subscription.company_id) {
    const { data: company } = await supabaseAdmin.from('companies').select('name').eq('id', subscription.company_id).maybeSingle();
    if (typeof company?.name === 'string' && company.name.trim()) accountName = company.name.trim();
  }

  const plan = XDRIVE_STANDARD_PLANS[subscription.plan_id];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.043, 0.184, 0.42);
  const orange = rgb(0.961, 0.639, 0);
  const dark = rgb(0.10, 0.12, 0.17);

  let y = 790;
  const text = (value: string, size = 10, weight: 'regular' | 'bold' = 'regular', x = 54, colour = dark) => {
    page.drawText(value, { x, y, size, font: weight === 'bold' ? bold : regular, color: colour });
    y -= size + 8;
  };
  const rule = () => {
    page.drawLine({ start: { x: 54, y }, end: { x: 541, y }, thickness: 1, color: rgb(0.88, 0.90, 0.93) });
    y -= 20;
  };

  text(COMPANY_CONFIG.legalName, 18, 'bold', 54, navy);
  text('Membership Contract Confirmation', 15, 'bold', 54, orange);
  text(`Company No. ${COMPANY_CONFIG.companyNumber}  |  VAT ${COMPANY_CONFIG.vat.registrationNumber}`, 9);
  text(COMPANY_CONFIG.address.full, 9);
  y -= 6;
  rule();

  text('Account holder', 10, 'bold', 54, navy);
  text(accountName, 12, 'bold');
  text(authData.user.email ?? 'Email not available', 9);
  y -= 6;

  text('Membership', 10, 'bold', 54, navy);
  text(`${plan.label} — ${money(plan.monthlyAmountPence)} per month excluding VAT`, 12, 'bold');
  text('Promotional period: first 3 calendar months free.', 10);
  text(`Trial start: ${formatDate(subscription.trial_started_at)}`, 10);
  text(`Trial end: ${formatDate(subscription.trial_ends_at)}`, 10);
  text(`Current status: ${String(subscription.status).replace(/_/g, ' ')}`, 10);
  y -= 6;

  text('Contract evidence', 10, 'bold', 54, navy);
  text(`Terms version: ${subscription.contract_terms_version}`, 10);
  text(`Terms accepted: ${formatDate(subscription.contract_accepted_at)}`, 10);
  text(`XDrive membership record: ${subscription.id}`, 8);
  text(`Stripe subscription reference: ${subscription.stripe_subscription_id ?? 'Pending Checkout completion'}`, 8);
  y -= 6;
  rule();

  text('Commercial terms', 10, 'bold', 54, navy);
  text('After the free period, the standard membership renews monthly unless cancelled.', 9);
  text('VAT is added where legally applicable. Final tax is determined in the Stripe billing flow.', 9);
  text('The XDrive membership charge is separate from transport-job payments.', 9);
  text('XDrive does not charge a commission or booking fee on the transport value under this launch model.', 9);
  y -= 6;

  text('Payment handling', 10, 'bold', 54, navy);
  text('Membership payments are made to XDrive Logistics Ltd through Stripe Billing.', 9);
  text('Transport-job payments use Stripe Connect direct charges to the supplier connected account.', 9);
  text('Bank/card credentials are handled by Stripe and are not stored by XDrive.', 9);
  y -= 12;

  text('This confirmation records the electronic membership selection and acceptance held by XDrive.', 8);
  text('The Membership & Subscription Terms and main Terms & Conditions remain part of the agreement.', 8);
  y -= 10;
  text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`, 7);

  const bytes = await pdf.save();
  const filename = `XDrive-Membership-Confirmation-${subscription.id.slice(0, 8).toUpperCase()}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
