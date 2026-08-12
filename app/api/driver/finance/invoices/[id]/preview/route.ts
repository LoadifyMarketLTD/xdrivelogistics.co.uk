import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePdf } from '../../../../../../../lib/server/invoicePdf';
import { loadInvoicePdfContext } from '../../../../../../../lib/server/invoicePdfContext';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const cleanText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const cleanFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'invoice';

const cleanServiceDescription = (value: unknown) => {
  const raw = cleanText(value);
  if (!raw) return 'Transport service';
  if (!raw.startsWith('{') && !raw.startsWith('[')) return raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const vehicle = cleanText(parsed.vehicle);
    const cargo = cleanText(parsed.cargo);
    return ['Transport service', vehicle, cargo].filter(Boolean).join(' · ').slice(0, 500);
  } catch {
    return 'Transport service';
  }
};

async function resolvePreviewer(request: NextRequest, invoiceId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice || typeof invoice.company_id !== 'string') return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', invoice.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'dispatcher', 'finance', 'driver'].includes(role)) return null;

  return { companyId: invoice.company_id as string, invoice };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const { id } = await params;
  let previewer: Awaited<ReturnType<typeof resolvePreviewer>>;
  try {
    previewer = await resolvePreviewer(request, id);
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Invoice access could not be verified.' });
  }
  if (!previewer) return respond(403, { error: 'You do not have access to preview this invoice.' });

  const invoice = previewer.invoice;
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, address_line1, address_line2, city, postcode, company_number, vat_number')
    .eq('id', previewer.companyId)
    .maybeSingle();
  if (companyError) return respond(500, { error: companyError.message });
  if (!company) return respond(422, { error: 'Invoice issuer company details are missing.' });

  const companyName = cleanText(company.name);
  const invoiceNumber = cleanText(invoice.invoice_number);
  const jobReference = cleanText(invoice.job_ref);
  if (!companyName || !invoiceNumber || !jobReference) {
    return respond(422, { error: 'Invoice header data is incomplete.' });
  }

  const netAmount = Number(invoice.net_amount);
  const vatAmount = Number(invoice.vat_amount);
  const vatRate = Number(invoice.vat_rate);
  const totalAmount = Number(invoice.amount);
  if (!Number.isFinite(netAmount) || netAmount <= 0
      || !Number.isFinite(vatAmount) || vatAmount < 0
      || !Number.isFinite(totalAmount) || totalAmount <= 0
      || ![0, 5, 20].includes(vatRate)
      || Math.abs(totalAmount - (netAmount + vatAmount)) > 0.01) {
    return respond(422, { error: 'Invoice totals are invalid. Fix the Draft before previewing.' });
  }

  const issuerAddress = [company.address_line1, company.address_line2, company.city, company.postcode]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');

  const pdfContext = await loadInvoicePdfContext({
    supabase: supabaseAdmin,
    companyId: previewer.companyId,
    jobId: typeof invoice.job_id === 'string' ? invoice.job_id : null,
    origin: request.nextUrl.origin,
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({
      invoiceNumber,
      jobReference,
      invoiceDate: cleanText(invoice.invoice_date, new Date().toISOString().slice(0, 10)),
      dueDate: cleanText(invoice.due_date, new Date().toISOString().slice(0, 10)),
      issuerName: companyName,
      issuerAddress,
      issuerCompanyNumber: company.company_number as string | null,
      issuerVatNumber: company.vat_number as string | null,
      issuerEmail: pdfContext.issuerEmail,
      issuerPhone: pdfContext.issuerPhone,
      issuerWebsite: 'www.xdrivelogistics.co.uk',
      clientName: cleanText(invoice.client_name, 'Customer'),
      clientAddress: invoice.client_address as string | null,
      clientEmail: invoice.client_email as string | null,
      pickupLocation: invoice.pickup_location as string | null,
      pickupDateTime: pdfContext.pickupDateTime ?? invoice.pickup_datetime as string | null,
      deliveryLocation: invoice.delivery_location as string | null,
      deliveryDateTime: pdfContext.deliveryDateTime ?? invoice.delivery_datetime as string | null,
      recipientName: pdfContext.recipientName,
      cargoDescription: pdfContext.cargoDescription,
      vehicleDescription: pdfContext.vehicleDescription,
      serviceDescription: cleanServiceDescription(invoice.service_description),
      bankAccountName: pdfContext.bankAccountName,
      bankSortCode: pdfContext.bankSortCode,
      bankAccountNumber: pdfContext.bankAccountNumber,
      paypalEmail: pdfContext.paypalEmail,
      logoBytes: pdfContext.logoBytes,
      evidenceImages: pdfContext.evidenceImages,
      netAmount,
      vatAmount,
      vatRate,
      totalAmount,
      currency: cleanText(invoice.currency, 'GBP'),
      paymentTerms: invoice.payment_terms as string | null,
    });
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Invoice PDF preview could not be generated.' });
  }

  if (!pdfBytes.byteLength || pdfBytes.byteLength > 10 * 1024 * 1024) {
    return respond(500, { error: 'Generated preview is empty or exceeds the 10 MB limit.' });
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cleanFileName(invoiceNumber)}-preview.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
