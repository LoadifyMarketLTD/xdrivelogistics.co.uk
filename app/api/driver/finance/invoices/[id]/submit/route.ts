import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePdf } from '../../../../../../../lib/server/invoicePdf';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../../../../mobile/_lib';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.companyId)
    .eq('user_id', driver.userId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });

  const membershipRole = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin'].includes(membershipRole)) {
    return respond(403, { error: 'Company owner or admin access is required to send invoices.' });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const fromEmail = process.env.FROM_EMAIL?.trim()
    || 'XDrive Logistics <no-reply@xdrivelogistics.co.uk>';
  if (!resendApiKey) {
    return respond(503, {
      error: 'Invoice delivery is not configured. RESEND_API_KEY is missing.',
    });
  }

  const { id } = await params;
  const { data: invoice, error: fetchError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', driver.companyId)
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
    .eq('company_id', driver.companyId)
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
      .eq('company_id', driver.companyId)
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

  if (!invoiceNumber) return failDelivery(422, 'Invoice number is missing. The invoice was not sent.');
  if (!jobReference) return failDelivery(422, 'Job reference is missing. The invoice was not sent.');
  if (!clientName) return failDelivery(422, 'Customer company name is missing. The invoice was not sent.');
  if (!currencyCode || currencyCode.length > 3) {
    return failDelivery(422, 'Invoice currency is invalid. The invoice was not sent.');
  }
  if (!Number.isFinite(netAmount) || netAmount <= 0
      || !Number.isFinite(vatAmount) || vatAmount < 0
      || !Number.isFinite(vatRate) || ![0, 5, 20].includes(vatRate)
      || !Number.isFinite(totalAmount) || totalAmount <= 0
      || Math.abs(totalAmount - (netAmount + vatAmount)) > 0.01) {
    return failDelivery(422, 'Invoice totals are invalid. Net amount plus VAT must equal the positive invoice total.');
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
    .eq('id', driver.companyId)
    .maybeSingle();
  if (companyError) return failDelivery(500, companyError.message);
  if (!company) return failDelivery(422, 'Invoice issuer company details are missing.');

  const companyName = cleanHeader(company.name);
  if (!companyName) return failDelivery(422, 'Invoice issuer company name is missing.');

  const issuerAddress = [
    company.address_line1,
    company.address_line2,
    company.city,
    company.postcode,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');

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
      issuerVatNumber: company.vat_number as string | null,
      clientName,
      clientAddress: claimedInvoice.client_address as string | null,
      clientEmail: recipientEmail,
      pickupLocation: claimedInvoice.pickup_location as string | null,
      deliveryLocation: claimedInvoice.delivery_location as string | null,
      serviceDescription: claimedInvoice.service_description as string | null,
      netAmount,
      vatAmount,
      vatRate,
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
  const storagePath = `${driver.companyId}/${claimedInvoice.id}/${fileName}`;
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
    uploaded_by: driver.userId,
  };
  if (existingDocument) {
    const { error } = await supabaseAdmin
      .from('invoice_documents')
      .update(documentValues)
      .eq('id', existingDocument.id)
      .eq('company_id', driver.companyId);
    if (error) return failDelivery(500, error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('invoice_documents')
      .insert({
        invoice_id: claimedInvoice.id,
        company_id: driver.companyId,
        doc_type: 'invoice_pdf',
        ...documentValues,
      });
    if (error) return failDelivery(500, error.message);
  }

  const attemptedAt = new Date().toISOString();
  const pickup = String(claimedInvoice.pickup_location ?? 'collection');
  const delivery = String(claimedInvoice.delivery_location ?? 'delivery');
  const dueDate = String(claimedInvoice.due_date ?? 'See attached invoice');

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
        subject: `Invoice ${invoiceNumber} from ${companyName}`,
        html: `
          <h2>Invoice ${escapeHtml(invoiceNumber)}</h2>
          <p>Hello ${escapeHtml(clientName)},</p>
          <p>Please find attached your invoice for job <strong>${escapeHtml(jobReference)}</strong>, covering the transport service from <strong>${escapeHtml(pickup)}</strong> to <strong>${escapeHtml(delivery)}</strong>.</p>
          <p><strong>Total:</strong> ${totalAmount.toFixed(2)} ${escapeHtml(currencyCode)}<br />
          <strong>Due date:</strong> ${escapeHtml(dueDate)}</p>
          <p>Kind regards,<br />${escapeHtml(companyName)}</p>
        `,
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
      submitted_by: driver.userId,
      delivery_state: 'sent',
      delivery_provider: 'resend',
      delivery_message_id: emailPayload.id,
      delivery_recipient_email: recipientEmail,
      delivery_attempted_at: attemptedAt,
      delivery_error: null,
      updated_at: attemptedAt,
    })
    .eq('id', claimedInvoice.id)
    .eq('company_id', driver.companyId)
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
