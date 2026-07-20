import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePdf } from '../../../../../../../lib/server/invoicePdf';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
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

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return { userId: authData.user.id, driverId: driverRow.id as string, companyId: driverRow.company_id as string };
}

const cleanFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const fromEmail = process.env.FROM_EMAIL?.trim() || 'XDrive Logistics <no-reply@xdrivelogistics.co.uk>';
  if (!resendApiKey) {
    return respond(503, { error: 'Invoice delivery is not configured. RESEND_API_KEY is missing.' });
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
    return respond(409, { error: 'This invoice is already being delivered. Refresh before retrying.' });
  }
  if (currentStatus !== 'Draft') {
    return respond(409, {
      error: `Invoice cannot be sent from status "${currentStatus}". Only Draft invoices can be sent.`,
    });
  }

  const recipientEmail = typeof invoice.client_email === 'string' ? invoice.client_email.trim().toLowerCase() : '';
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return respond(422, { error: 'A valid client email address is required before sending the invoice.' });
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
    .eq('status', invoice.status)
    .in('delivery_state', ['idle', 'failed'])
    .select('*')
    .maybeSingle();

  if (claimError) return respond(500, { error: claimError.message });
  if (!claimedInvoice) {
    return respond(409, { error: 'Invoice delivery was claimed by another request. Refresh before retrying.' });
  }

  const failDelivery = async (status: number, message: string) => {
    await supabaseAdmin!
      .from('invoices')
      .update({
        delivery_state: 'failed',
        delivery_error: message,
        delivery_attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimedInvoice.id)
      .eq('delivery_state', 'sending');
    return respond(status, { error: message });
  };

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, address_line1, address_line2, city, postcode, company_number, vat_number')
    .eq('id', driver.companyId)
    .maybeSingle();
  if (companyError) return failDelivery(500, companyError.message);
  if (!company) return failDelivery(422, 'Invoice issuer company details are missing.');

  const issuerAddress = [company.address_line1, company.address_line2, company.city, company.postcode]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({
      invoiceNumber: String(claimedInvoice.invoice_number ?? claimedInvoice.id),
      invoiceDate: String(claimedInvoice.invoice_date ?? new Date().toISOString().slice(0, 10)),
      dueDate: String(claimedInvoice.due_date ?? new Date().toISOString().slice(0, 10)),
      issuerName: String(company.name ?? 'XDrive Logistics'),
      issuerAddress,
      issuerCompanyNumber: company.company_number as string | null,
      issuerVatNumber: company.vat_number as string | null,
      clientName: String(claimedInvoice.client_name ?? 'Customer'),
      clientAddress: claimedInvoice.client_address as string | null,
      clientEmail: recipientEmail,
      pickupLocation: claimedInvoice.pickup_location as string | null,
      deliveryLocation: claimedInvoice.delivery_location as string | null,
      serviceDescription: claimedInvoice.service_description as string | null,
      netAmount: Number(claimedInvoice.net_amount ?? claimedInvoice.amount ?? 0),
      vatAmount: Number(claimedInvoice.vat_amount ?? 0),
      vatRate: Number(claimedInvoice.vat_rate ?? 0),
      totalAmount: Number(claimedInvoice.amount ?? 0),
      currency: String(claimedInvoice.currency ?? 'GBP'),
      paymentTerms: claimedInvoice.payment_terms as string | null,
    });
  } catch (reason) {
    return failDelivery(500, reason instanceof Error ? reason.message : 'Invoice PDF generation failed.');
  }

  const fileName = `${cleanFileName(String(claimedInvoice.invoice_number ?? claimedInvoice.id))}.pdf`;
  const storagePath = `${driver.companyId}/${claimedInvoice.id}/${fileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('invoice-docs')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true, cacheControl: '3600' });
  if (uploadError) return failDelivery(500, `Invoice PDF storage failed: ${uploadError.message}`);

  const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
    .from('invoice_documents')
    .select('id')
    .eq('invoice_id', claimedInvoice.id)
    .eq('doc_type', 'invoice_pdf')
    .maybeSingle();
  if (existingDocumentError) return failDelivery(500, existingDocumentError.message);

  if (existingDocument) {
    const { error: documentUpdateError } = await supabaseAdmin
      .from('invoice_documents')
      .update({
        file_url: storagePath,
        file_name: fileName,
        file_size_bytes: pdfBytes.byteLength,
        uploaded_by: driver.userId,
      })
      .eq('id', existingDocument.id);
    if (documentUpdateError) return failDelivery(500, documentUpdateError.message);
  } else {
    const { error: documentInsertError } = await supabaseAdmin
      .from('invoice_documents')
      .insert({
        invoice_id: claimedInvoice.id,
        company_id: driver.companyId,
        uploaded_by: driver.userId,
        doc_type: 'invoice_pdf',
        file_url: storagePath,
        file_name: fileName,
        file_size_bytes: pdfBytes.byteLength,
      });
    if (documentInsertError) return failDelivery(500, documentInsertError.message);
  }

  const attemptedAt = new Date().toISOString();
  const invoiceNumber = String(claimedInvoice.invoice_number ?? claimedInvoice.id);
  const clientName = String(claimedInvoice.client_name ?? 'Customer');
  const pickup = String(claimedInvoice.pickup_location ?? 'collection');
  const delivery = String(claimedInvoice.delivery_location ?? 'delivery');
  const companyName = String(company.name ?? 'XDrive Logistics');
  const currencyCode = String(claimedInvoice.currency ?? 'GBP');
  const dueDate = String(claimedInvoice.due_date ?? 'See attached invoice');

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      subject: `Invoice ${invoiceNumber} from ${companyName}`,
      html: `
        <h2>Invoice ${escapeHtml(invoiceNumber)}</h2>
        <p>Hello ${escapeHtml(clientName)},</p>
        <p>Please find attached your invoice for the transport service from <strong>${escapeHtml(pickup)}</strong> to <strong>${escapeHtml(delivery)}</strong>.</p>
        <p><strong>Total:</strong> ${Number(claimedInvoice.amount ?? 0).toFixed(2)} ${escapeHtml(currencyCode)}<br />
        <strong>Due date:</strong> ${escapeHtml(dueDate)}</p>
        <p>Kind regards,<br />${escapeHtml(companyName)}</p>
      `,
      attachments: [{ filename: fileName, content: Buffer.from(pdfBytes).toString('base64') }],
    }),
  });

  const emailPayload = (await emailResponse.json().catch(() => null)) as { id?: string; message?: string; error?: { message?: string } } | null;
  if (!emailResponse.ok || !emailPayload?.id) {
    const deliveryError = emailPayload?.error?.message ?? emailPayload?.message ?? `Email provider returned ${emailResponse.status}.`;
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
    .eq('delivery_state', 'sending')
    .select('id, status, submitted_at, delivery_state, delivery_message_id, delivery_recipient_email')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) {
    return respond(500, {
      error: 'The email provider accepted the invoice, but the delivery record could not be finalised. Do not resend until support verifies the provider message.',
      deliveryMessageId: emailPayload.id,
    });
  }

  return respond(200, {
    invoice: {
      ...updated,
      status: toCanonicalInvoiceStatus((updated as { status?: string }).status),
    },
  });
}
