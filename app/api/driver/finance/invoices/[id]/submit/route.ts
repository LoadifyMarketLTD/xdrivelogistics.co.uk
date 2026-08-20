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
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';
import {
  normalizeInvoiceVatTreatment,
  validateInvoiceVatTotals,
} from '../../../../../../../lib/invoiceVat';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const cleanFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'invoice';

const cleanHeader = (value: unknown) =>
  String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160);

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const DEFAULT_EMAIL_SUBJECT = 'Invoice from [[My company]] - Load: [[Load ID]]';
const DEFAULT_EMAIL_MESSAGE = `Dear [[Customer company]],

I am attaching Invoice [[Invoice number]] for Load [[Load ID]].

Details:
Late commercial payments may be subject to statutory interest and recovery-cost compensation where applicable.

Invoice: [[Invoice number]]
Date: [[Invoice date]]
Amount Due: [[Currency symbol]][[Gross total]]
Load: [[Load ID]]
Supplier: [[My company]]

Please let us know if you have any questions.

All the best,
[[My company]]`;

const cleanTemplateText = (value: unknown, maxLength: number) =>
  typeof value === 'string'
    ? value.replaceAll('\u0000', '').trim().slice(0, maxLength)
    : '';

const replaceTemplateTokens = (
  template: string,
  values: Record<string, string>,
) => Object.entries(values).reduce(
  (output, [token, value]) => output.replaceAll(`[[${token}]]`, value),
  template,
);

const currencySymbol = (code: string) => {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? `${code} `;
  } catch {
    return `${code} `;
  }
};

const displayDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Not set';
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const cleanServiceDescription = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Transport service';
  if (!raw.startsWith('{') && !raw.startsWith('[')) return raw.slice(0, 500);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const vehicle = typeof parsed.vehicle === 'string' ? parsed.vehicle.trim() : '';
    const cargo = typeof parsed.cargo === 'string' ? parsed.cargo.trim() : '';
    const parts = ['Transport service', vehicle, cargo].filter(Boolean);
    return parts.join(' · ').slice(0, 500);
  } catch {
    return 'Transport service';
  }
};

const messageToHtml = (message: string) =>
  message
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
    .join('\n');

const isMissingDeliverySchema = (
  error: { code?: string | null; message?: string | null } | null | undefined
) => {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (message.includes('delivery_') && (message.includes('column') || message.includes('schema cache')))
  );
};

type InvoiceSenderContext = {
  userId: string;
  companyId: string;
};

async function resolveInvoiceSender(request: NextRequest, invoiceId: string): Promise<InvoiceSenderContext | NextResponse> {
  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator!.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { data: invoice, error: invoiceError } = await supabaseAdmin!
    .from('invoices')
    .select('id, company_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) return respond(500, { error: invoiceError.message });
  if (!invoice || typeof invoice.company_id !== 'string') return respond(404, { error: 'Invoice not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin!
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', invoice.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });

  const membershipRole = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'dispatcher', 'finance'].includes(membershipRole)) {
    return respond(403, { error: 'Finance workspace role is required to send invoices.' });
  }

  return {
    userId: authData.user.id,
    companyId: invoice.company_id,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const fromEmail = process.env.FROM_EMAIL?.trim()
    || 'XDrive Logistics <no-reply@xdrivelogistics.co.uk>';
  if (!resendApiKey) {
    return respond(503, {
      error: 'Invoice delivery is not configured. RESEND_API_KEY is missing.',
    });
  }

  let requestBody: Record<string, unknown> = {};
  try {
    const rawBody = await request.text();
    if (rawBody.trim()) requestBody = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid invoice email template payload.' });
  }

  const requestedSubject = cleanTemplateText(requestBody.subject, 500);
  const requestedMessage = cleanTemplateText(requestBody.message, 10_000);
  if (requestBody.subject !== undefined && !requestedSubject) {
    return respond(422, { error: 'Invoice email subject cannot be empty.' });
  }
  if (requestBody.message !== undefined && !requestedMessage) {
    return respond(422, { error: 'Invoice email message cannot be empty.' });
  }

  const { id } = await params;
  const sender = await resolveInvoiceSender(request, id);
  if (sender instanceof NextResponse) return sender;

  const { data: invoice, error: fetchError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', sender.companyId)
    .maybeSingle();
  if (fetchError) return respond(500, { error: fetchError.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  if (typeof invoice.delivery_state !== 'string') {
    return respond(503, {
      error: 'Invoice delivery is not enabled in the database yet. The invoice remains Draft.',
    });
  }

  const currentStatus = toCanonicalInvoiceStatus(invoice.status);
  if (currentStatus === 'Sent' && invoice.delivery_message_id) {
    return respond(200, {
      invoice: {
        id: invoice.id,
        status: currentStatus,
        submitted_at: invoice.submitted_at,
        delivery_message_id: invoice.delivery_message_id,
      },
      replayed: true,
    });
  }
  if (invoice.delivery_state === 'sending') {
    return respond(409, {
      error: 'This invoice is already being delivered. Do not resend until the current attempt is verified.',
    });
  }
  if (currentStatus !== 'Draft') {
    return respond(409, {
      error: `Invoice cannot be sent from status "${currentStatus}". Only Draft invoices can be sent.`,
    });
  }

  const recipientEmail = typeof invoice.client_email === 'string'
    ? invoice.client_email.trim().toLowerCase()
    : '';
  if (!validEmail(recipientEmail)) {
    return respond(422, {
      error: 'A valid client email address is required before sending the invoice.',
    });
  }

  const claimTime = new Date().toISOString();
  const { data: claimedInvoice, error: claimError } = await supabaseAdmin
    .from('invoices')
    .update({
      delivery_state: 'sending',
      delivery_attempted_at: claimTime,
      delivery_recipient_email: recipientEmail,
      delivery_error: null,
      updated_at: claimTime,
    })
    .eq('id', invoice.id)
    .eq('company_id', sender.companyId)
    .eq('status', invoice.status)
    .in('delivery_state', ['idle', 'failed'])
    .select('*')
    .maybeSingle();

  if (claimError) {
    if (isMissingDeliverySchema(claimError)) {
      return respond(503, {
        error: 'Invoice delivery is not enabled in the database yet. The invoice remains Draft.',
      });
    }
    return respond(500, { error: claimError.message });
  }
  if (!claimedInvoice) {
    return respond(409, {
      error: 'Invoice delivery was claimed by another request. Refresh before retrying.',
    });
  }

  const failDelivery = async (status: number, message: string) => {
    await supabaseAdmin!
      .from('invoices')
      .update({
        delivery_state: 'failed',
        delivery_error: message.slice(0, 2000),
        delivery_attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimedInvoice.id)
      .eq('company_id', sender.companyId)
      .eq('delivery_state', 'sending');
    return respond(status, { error: message, invoiceStatus: 'Draft' });
  };

  const invoiceNumber = cleanHeader(claimedInvoice.invoice_number);
  const jobReference = cleanHeader(claimedInvoice.job_ref);
  const clientName = cleanHeader(claimedInvoice.client_name);
  const currencyCode = cleanHeader(claimedInvoice.currency ?? 'GBP') || 'GBP';
  const netAmount = Number(claimedInvoice.net_amount);
  const vatAmount = Number(claimedInvoice.vat_amount);
  const vatRate = Number(claimedInvoice.vat_rate);
  const totalAmount = Number(claimedInvoice.amount);
  const vatTreatment = normalizeInvoiceVatTreatment(claimedInvoice.vat_treatment);

  if (!invoiceNumber) return failDelivery(422, 'Invoice number is missing. The invoice was not sent.');
  if (!jobReference) return failDelivery(422, 'Job reference is missing. The invoice was not sent.');
  if (!clientName) return failDelivery(422, 'Customer company name is missing. The invoice was not sent.');
  if (!currencyCode || currencyCode.length > 3) {
    return failDelivery(422, 'Invoice currency is invalid. The invoice was not sent.');
  }
  if (!vatTreatment || !validateInvoiceVatTotals({
    netAmount,
    vatAmount,
    vatRate,
    totalAmount,
    treatment: vatTreatment,
  })) {
    return failDelivery(422, 'Invoice VAT treatment/totals are invalid. The invoice was not sent.');
  }

  const claimedRecipientEmail = typeof claimedInvoice.client_email === 'string'
    ? claimedInvoice.client_email.trim().toLowerCase()
    : '';
  if (claimedRecipientEmail !== recipientEmail) {
    return failDelivery(409, 'The customer email changed while delivery was being prepared. Refresh and retry.');
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, address_line1, address_line2, city, postcode, company_number, vat_number')
    .eq('id', sender.companyId)
    .maybeSingle();
  if (companyError) return failDelivery(500, companyError.message);
  if (!company) return failDelivery(422, 'Invoice issuer company details are missing.');

  const companyName = cleanHeader(company.name);
  if (!companyName) return failDelivery(422, 'Invoice issuer company name is missing.');

  const issuerVatNumber = cleanHeader(claimedInvoice.issuer_vat_number_snapshot)
    || cleanHeader(company.vat_number);
  const customerVatNumber = cleanHeader(claimedInvoice.customer_vat_number_snapshot);
  if (vatTreatment !== 'not_registered' && !issuerVatNumber) {
    return failDelivery(422, 'This VAT treatment requires the issuer VAT registration number.');
  }
  if (vatTreatment === 'reverse_charge' && claimedInvoice.buyer_company_id && !customerVatNumber) {
    return failDelivery(422, 'Reverse-charge invoice requires the buyer VAT registration number.');
  }

  const issuerAddress = [
    company.address_line1,
    company.address_line2,
    company.city,
    company.postcode,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');

  const templateValues = {
    'My company': companyName,
    'Customer company': clientName,
    'Invoice number': invoiceNumber,
    'Invoice date': displayDate(claimedInvoice.invoice_date),
    'Currency symbol': currencySymbol(currencyCode),
    'Gross total': totalAmount.toFixed(2),
    'Load ID': jobReference,
  };
  const resolvedSubject = cleanHeader(replaceTemplateTokens(
    requestedSubject || DEFAULT_EMAIL_SUBJECT,
    templateValues,
  ));
  const resolvedMessage = replaceTemplateTokens(
    requestedMessage || DEFAULT_EMAIL_MESSAGE,
    templateValues,
  ).trim();

  if (!resolvedSubject) return failDelivery(422, 'Invoice email subject resolved to an empty value.');
  if (!resolvedMessage) return failDelivery(422, 'Invoice email message resolved to an empty value.');

  const pdfContext = await loadInvoicePdfContext({
    supabase: supabaseAdmin,
    companyId: sender.companyId,
    jobId: typeof claimedInvoice.job_id === 'string' ? claimedInvoice.job_id : null,
    origin: request.nextUrl.origin,
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({
      invoiceNumber,
      jobReference,
      invoiceDate: String(claimedInvoice.invoice_date ?? new Date().toISOString().slice(0, 10)),
      dueDate: String(claimedInvoice.due_date ?? new Date().toISOString().slice(0, 10)),
      issuerName: companyName,
      issuerAddress,
      issuerCompanyNumber: company.company_number as string | null,
      issuerVatNumber: issuerVatNumber || null,
      issuerEmail: pdfContext.issuerEmail,
      issuerPhone: pdfContext.issuerPhone,
      issuerWebsite: 'www.xdrivelogistics.co.uk',
      clientName,
      clientAddress: claimedInvoice.client_address as string | null,
      clientEmail: recipientEmail,
      customerVatNumber: customerVatNumber || null,
      pickupLocation: claimedInvoice.pickup_location as string | null,
      pickupDateTime: pdfContext.pickupDateTime ?? claimedInvoice.pickup_datetime as string | null,
      deliveryLocation: claimedInvoice.delivery_location as string | null,
      deliveryDateTime: pdfContext.deliveryDateTime ?? claimedInvoice.delivery_datetime as string | null,
      recipientName: pdfContext.recipientName,
      cargoDescription: pdfContext.cargoDescription,
      vehicleDescription: pdfContext.vehicleDescription,
      serviceDescription: cleanServiceDescription(claimedInvoice.service_description),
      bankAccountName: pdfContext.bankAccountName,
      bankSortCode: pdfContext.bankSortCode,
      bankAccountNumber: pdfContext.bankAccountNumber,
      paypalEmail: pdfContext.paypalEmail,
      logoBytes: pdfContext.logoBytes,
      evidenceImages: pdfContext.evidenceImages,
      netAmount,
      vatAmount,
      vatRate,
      vatTreatment,
      totalAmount,
      currency: currencyCode,
      paymentTerms: claimedInvoice.payment_terms as string | null,
    });
  } catch (reason) {
    return failDelivery(
      500,
      reason instanceof Error ? reason.message : 'Invoice PDF generation failed.'
    );
  }

  if (!pdfBytes.byteLength || pdfBytes.byteLength > 10 * 1024 * 1024) {
    return failDelivery(500, 'Generated invoice PDF is empty or exceeds the 10 MB limit.');
  }

  const fileName = `${cleanFileName(invoiceNumber)}.pdf`;
  const storagePath = `${sender.companyId}/${claimedInvoice.id}/${fileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('invoice-docs')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    });
  if (uploadError) {
    return failDelivery(500, `Invoice PDF storage failed: ${uploadError.message}`);
  }

  const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
    .from('invoice_documents')
    .select('id')
    .eq('invoice_id', claimedInvoice.id)
    .eq('doc_type', 'invoice_pdf')
    .maybeSingle();
  if (existingDocumentError) return failDelivery(500, existingDocumentError.message);

  const documentValues = {
    file_url: storagePath,
    file_name: fileName,
    file_size_bytes: pdfBytes.byteLength,
    uploaded_by: sender.userId,
  };
  if (existingDocument) {
    const { error } = await supabaseAdmin
      .from('invoice_documents')
      .update(documentValues)
      .eq('id', existingDocument.id)
      .eq('company_id', sender.companyId);
    if (error) return failDelivery(500, error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('invoice_documents')
      .insert({
        invoice_id: claimedInvoice.id,
        company_id: sender.companyId,
        doc_type: 'invoice_pdf',
        ...documentValues,
      });
    if (error) return failDelivery(500, error.message);
  }

  const attemptedAt = new Date().toISOString();

  let emailResponse: Response;
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `invoice-send/${claimedInvoice.id}`,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: resolvedSubject,
        text: resolvedMessage,
        html: messageToHtml(resolvedMessage),
        attachments: [
          {
            filename: fileName,
            content: Buffer.from(pdfBytes).toString('base64'),
          },
        ],
      }),
    });
  } catch (reason) {
    return failDelivery(
      502,
      reason instanceof Error
        ? `Invoice was not sent: ${reason.message}`
        : 'Invoice provider request failed.'
    );
  }

  const emailPayload = (await emailResponse.json().catch(() => null)) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  } | null;
  if (!emailResponse.ok || !emailPayload?.id) {
    const deliveryError = emailPayload?.error?.message
      ?? emailPayload?.message
      ?? `Email provider returned ${emailResponse.status}.`;
    return failDelivery(502, `Invoice was not sent: ${deliveryError}`);
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update({
      status: toLegacyInvoiceStatusForDb('Sent'),
      submitted_at: attemptedAt,
      submitted_by: sender.userId,
      delivery_state: 'sent',
      delivery_provider: 'resend',
      delivery_message_id: emailPayload.id,
      delivery_recipient_email: recipientEmail,
      delivery_attempted_at: attemptedAt,
      delivery_error: null,
      updated_at: attemptedAt,
    })
    .eq('id', claimedInvoice.id)
    .eq('company_id', sender.companyId)
    .eq('delivery_state', 'sending')
    .select(
      'id, status, submitted_at, delivery_state, delivery_message_id, delivery_recipient_email'
    )
    .maybeSingle();

  if (updateError || !updated) {
    return respond(500, {
      error: 'The provider accepted the invoice, but XDrive could not finalise the delivery record. Do not resend until support verifies the provider message.',
      deliveryMessageId: emailPayload.id,
    });
  }

  return respond(200, {
    invoice: {
      ...updated,
      status: toCanonicalInvoiceStatus(updated.status),
    },
    replayed: false,
  });
}
