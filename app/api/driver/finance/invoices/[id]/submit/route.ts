import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePdf } from '../../../../../../../lib/server/invoicePdf';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

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
  if (currentStatus !== 'Draft') {
    return respond(409, {
      error: `Invoice cannot be sent from status "${currentStatus}". Only Draft invoices can be sent.`,
    });
  }

  const recipientEmail = typeof invoice.client_email === 'string' ? invoice.client_email.trim().toLowerCase() : '';
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return respond(422, { error: 'A valid client email address is required before sending the invoice.' });
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, address_line1, address_line2, city, postcode, company_number, vat_number')
    .eq('id', driver.companyId)
    .maybeSingle();
  if (companyError) return respond(500, { error: companyError.message });
  if (!company) return respond(422, { error: 'Invoice issuer company details are missing.' });

  const issuerAddress = [company.address_line1, company.address_line2, company.city, company.postcode]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({
      invoiceNumber: String(invoice.invoice_number ?? invoice.id),
      invoiceDate: String(invoice.invoice_date ?? new Date().toISOString().slice(0, 10)),
      dueDate: String(invoice.due_date ?? new Date().toISOString().slice(0, 10)),
      issuerName: String(company.name ?? 'XDrive Logistics'),
      issuerAddress,
      issuerCompanyNumber: company.company_number as string | null,
      issuerVatNumber: company.vat_number as string | null,
      clientName: String(invoice.client_name ?? 'Customer'),
      clientAddress: invoice.client_address as string | null,
      clientEmail: recipientEmail,
      pickupLocation: invoice.pickup_location as string | null,
      deliveryLocation: invoice.delivery_location as string | null,
      serviceDescription: invoice.service_description as string | null,
      netAmount: Number(invoice.net_amount ?? invoice.amount ?? 0),
      vatAmount: Number(invoice.vat_amount ?? 0),
      vatRate: Number(invoice.vat_rate ?? 0),
      totalAmount: Number(invoice.amount ?? 0),
      currency: String(invoice.currency ?? 'GBP'),
      paymentTerms: invoice.payment_terms as string | null,
    });
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Invoice PDF generation failed.' });
  }

  const fileName = `${cleanFileName(String(invoice.invoice_number ?? invoice.id))}.pdf`;
  const storagePath = `${driver.companyId}/${invoice.id}/${fileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('invoice-docs')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true, cacheControl: '3600' });
  if (uploadError) return respond(500, { error: `Invoice PDF storage failed: ${uploadError.message}` });

  const { data: existingDocument } = await supabaseAdmin
    .from('invoice_documents')
    .select('id')
    .eq('invoice_id', invoice.id)
    .eq('doc_type', 'invoice_pdf')
    .maybeSingle();

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
    if (documentUpdateError) return respond(500, { error: documentUpdateError.message });
  } else {
    const { error: documentInsertError } = await supabaseAdmin
      .from('invoice_documents')
      .insert({
        invoice_id: invoice.id,
        company_id: driver.companyId,
        uploaded_by: driver.userId,
        doc_type: 'invoice_pdf',
        file_url: storagePath,
        file_name: fileName,
        file_size_bytes: pdfBytes.byteLength,
      });
    if (documentInsertError) return respond(500, { error: documentInsertError.message });
  }

  const attemptedAt = new Date().toISOString();
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      subject: `Invoice ${invoice.invoice_number ?? invoice.id} from ${company.name ?? 'XDrive Logistics'}`,
      html: `
        <h2>Invoice ${String(invoice.invoice_number ?? invoice.id)}</h2>
        <p>Hello ${String(invoice.client_name ?? 'Customer')},</p>
        <p>Please find attached your invoice for the transport service from <strong>${String(invoice.pickup_location ?? 'collection')}</strong> to <strong>${String(invoice.delivery_location ?? 'delivery')}</strong>.</p>
        <p><strong>Total:</strong> ${Number(invoice.amount ?? 0).toFixed(2)} ${String(invoice.currency ?? 'GBP')}<br />
        <strong>Due date:</strong> ${String(invoice.due_date ?? 'See attached invoice')}</p>
        <p>Kind regards,<br />${String(company.name ?? 'XDrive Logistics')}</p>
      `,
      attachments: [{ filename: fileName, content: Buffer.from(pdfBytes).toString('base64') }],
    }),
  });

  const emailPayload = (await emailResponse.json().catch(() => null)) as { id?: string; message?: string; error?: { message?: string } } | null;
  if (!emailResponse.ok || !emailPayload?.id) {
    const deliveryError = emailPayload?.error?.message ?? emailPayload?.message ?? `Email provider returned ${emailResponse.status}.`;
    await supabaseAdmin
      .from('invoices')
      .update({
        delivery_provider: 'resend',
        delivery_recipient_email: recipientEmail,
        delivery_attempted_at: attemptedAt,
        delivery_error: deliveryError,
        updated_at: attemptedAt,
      })
      .eq('id', invoice.id);
    return respond(502, { error: `Invoice was not sent: ${deliveryError}` });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update({
      status: toLegacyInvoiceStatusForDb('Sent'),
      submitted_at: attemptedAt,
      submitted_by: driver.userId,
      delivery_provider: 'resend',
      delivery_message_id: emailPayload.id,
      delivery_recipient_email: recipientEmail,
      delivery_attempted_at: attemptedAt,
      delivery_error: null,
      updated_at: attemptedAt,
    })
    .eq('id', invoice.id)
    .eq('status', invoice.status)
    .select('id, status, submitted_at, delivery_message_id, delivery_recipient_email')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) {
    return respond(409, { error: 'Invoice changed after delivery. Refresh to verify the current status.' });
  }

  return respond(200, {
    invoice: {
      ...updated,
      status: toCanonicalInvoiceStatus((updated as { status?: string }).status),
    },
  });
}
