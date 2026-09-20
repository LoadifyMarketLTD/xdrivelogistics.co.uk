'use client';

import React from 'react';
import { toCanonicalInvoiceStatus } from '../../lib/invoiceStatus';
import { DEFAULT_COMPANY_SETTINGS, type CompanySettingsValues } from '../../lib/companySettings';

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  jobRef: string;
  date: string;
  dueDate: string;
  status: 'Draft' | 'Sent' | 'Overdue' | 'Paid' | 'Disputed' | 'Cancelled';
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  pickupLocation: string;
  pickupDateTime: string;
  deliveryLocation: string;
  deliveryDateTime: string;
  deliveryRecipient: string;
  serviceDescription: string;
  amount: number;
  paymentTerms: 'Pay now' | '14 days' | '30 days';
  lateFee: string;
  vatRate: 0 | 5 | 20;
  netAmount: number;
  vatAmount: number;
  podPhotos?: string[];
  signature?: string;
  recipientName?: string;
  loadId?: string;
  customerRef?: string;
  vehicleType?: string;
  vehicleRegistration?: string;
  orderedAt?: string;
  deliveredAt?: string;
  leftAt?: string;
  noOfItems?: number;
  deliveryNotes?: string;
  cargoSummary?: string;
  issuerName?: string;
  issuerAddress?: string;
  issuerCompanyNumber?: string;
  issuerVatNumber?: string;
  issuerXdId?: string;
  issuerEmail?: string;
  issuerPhone?: string;
  customerCompanyNumber?: string;
  customerVatNumber?: string;
  customerXdId?: string;
  bankAccountName?: string;
  bankSortCode?: string;
  bankAccountNumber?: string;
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  showPreview?: boolean;
  companySettings?: CompanySettingsValues;
}

const fmtDate = (value?: string, withTime = false) => {
  if (!value) return 'Not supplied';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return withTime
    ? d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric' });
};

const money = (value: number) => `£${Number(value || 0).toFixed(2)}`;

export default function InvoiceTemplate({
  invoice,
  companySettings = DEFAULT_COMPANY_SETTINGS,
}: InvoiceTemplateProps) {
  const issuerName = invoice.issuerName || companySettings.legalName || companySettings.companyName;
  const issuerAddress = invoice.issuerAddress || [companySettings.street, companySettings.city, companySettings.postcode].filter(Boolean).join(', ');
  const bankName = invoice.bankAccountName || companySettings.bankAccountName;
  const bankSort = invoice.bankSortCode || companySettings.bankSortCode;
  const bankAccount = invoice.bankAccountNumber || companySettings.bankAccountNumber;
  const status = toCanonicalInvoiceStatus(invoice.status);
  const smallMeta = (items: Array<string | undefined>) => items.filter(Boolean).join(' · ');

  const section: React.CSSProperties = { border: '1px solid #e4e7ec', borderRadius: 12, padding: 14, background: '#fff' };
  const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: '#0B2F6B', marginBottom: 8 };
  const muted: React.CSSProperties = { color: '#667085', fontSize: 12, lineHeight: 1.45 };
  const label: React.CSSProperties = { color: '#667085', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' };

  return (
    <div className="invoice-print-area" style={{ background: '#fff', maxWidth: 860, margin: '0 auto', color: '#1A1F2B', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', border: '1px solid #e4e7ec', borderRadius: 16, overflow: 'hidden' }}>
      <style>{`@media print{.invoice-print-area{max-width:none!important;border:0!important;border-radius:0!important}.invoice-no-break{break-inside:avoid}}`}</style>

      <header style={{ background: '#0B2F6B', color: '#fff', padding: '24px 28px', borderBottom: '5px solid #F5A300', display: 'flex', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div style={{ fontSize: 27, fontWeight: 900 }}>XDRIVE <span style={{ color: '#F5A300', fontSize: 16 }}>LOGISTICS</span></div>
          <div style={{ opacity: .88, marginTop: 3 }}>Transport Invoice</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>INVOICE</div>
          <div style={{ fontWeight: 800 }}>{invoice.invoiceNumber}</div>
          <div style={{ fontSize: 11, opacity: .85 }}>{status.toUpperCase()}</div>
        </div>
      </header>

      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="invoice-no-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <section style={{ ...section, background: '#f8fafc' }}>
            <div style={kicker}>Issued By</div>
            <strong>{issuerName}</strong>
            <div style={{ ...muted, marginTop: 6 }}>{issuerAddress || 'Address not supplied'}</div>
            <div style={{ ...muted, fontSize: 10, marginTop: 8 }}>{smallMeta([
              invoice.issuerXdId ? `XDrive ID ${invoice.issuerXdId}` : undefined,
              invoice.issuerCompanyNumber ? `Company No. ${invoice.issuerCompanyNumber}` : undefined,
              invoice.issuerVatNumber ? `VAT ${invoice.issuerVatNumber}` : undefined,
            ])}</div>
          </section>
          <section style={{ ...section, background: '#f8fafc' }}>
            <div style={kicker}>Bill To</div>
            <strong>{invoice.clientName || 'Not supplied'}</strong>
            <div style={{ ...muted, marginTop: 6 }}>{invoice.clientAddress || 'Address not supplied'}</div>
            <div style={{ ...muted, fontSize: 10, marginTop: 8 }}>{smallMeta([
              invoice.customerXdId ? `XDrive ID ${invoice.customerXdId}` : undefined,
              invoice.customerCompanyNumber ? `Company No. ${invoice.customerCompanyNumber}` : undefined,
              invoice.customerVatNumber ? `VAT ${invoice.customerVatNumber}` : undefined,
            ])}</div>
          </section>
        </div>

        <section className="invoice-no-break" style={{ ...section, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
            {[
              ['Invoice Date', fmtDate(invoice.date)],
              ['Due Date', fmtDate(invoice.dueDate)],
              ['Job Ref', invoice.jobRef || '—'],
              ['Load ID', invoice.loadId || '—'],
              ['Customer Ref', invoice.customerRef || '—'],
            ].map(([k, v], index) => (
              <div key={k} style={{ padding: 12, borderRight: index < 4 ? '1px solid #e4e7ec' : undefined }}>
                <div style={label}>{k}</div>
                <strong style={{ display: 'block', marginTop: 4, fontSize: 12, overflowWrap: 'anywhere' }}>{v}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="invoice-no-break" style={section}>
          <div style={kicker}>Job & Delivery Record</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ border: '1px solid #e4e7ec', borderRadius: 10, padding: 12 }}>
              <div style={label}>Collection</div>
              <strong style={{ display: 'block', marginTop: 4 }}>{invoice.pickupLocation || 'Not supplied'}</strong>
              <div style={{ ...muted, marginTop: 5 }}>{fmtDate(invoice.pickupDateTime, true)}</div>
            </div>
            <div style={{ border: '1px solid #e4e7ec', borderRadius: 10, padding: 12 }}>
              <div style={label}>Delivery</div>
              <strong style={{ display: 'block', marginTop: 4 }}>{invoice.deliveryLocation || 'Not supplied'}</strong>
              <div style={{ ...muted, marginTop: 5 }}>{fmtDate(invoice.deliveryDateTime, true)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div><span style={label}>Vehicle</span><strong style={{ display: 'block', marginTop: 3 }}>{[invoice.vehicleType, invoice.vehicleRegistration].filter(Boolean).join(' · ') || 'Not supplied'}</strong></div>
            <div><span style={label}>Cargo</span><strong style={{ display: 'block', marginTop: 3 }}>{invoice.cargoSummary || (invoice.noOfItems ? `${invoice.noOfItems} item(s)` : 'Not supplied')}</strong></div>
          </div>
        </section>

        <section className="invoice-no-break" style={{ ...section, background: '#f8fafc' }}>
          <div style={kicker}>Proof of Delivery</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              ['Delivered', fmtDate(invoice.deliveredAt || invoice.deliveryDateTime, true)],
              ['Received By', invoice.deliveryRecipient || invoice.recipientName || 'Not supplied'],
              ['Left At', invoice.leftAt || 'Not recorded'],
              ['Items', invoice.noOfItems != null ? String(invoice.noOfItems) : 'Not recorded'],
            ].map(([k,v]) => <div key={k} style={{ background: '#fff', border: '1px solid #e4e7ec', borderRadius: 9, padding: 10 }}><div style={label}>{k}</div><strong style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{v}</strong></div>)}
          </div>
          <div style={{ marginTop: 10 }}><span style={label}>Delivery Notes</span><div style={{ marginTop: 4, fontWeight: 600 }}>{invoice.deliveryNotes || 'No delivery notes recorded.'}</div></div>
          <div style={{ marginTop: 8, textAlign: 'right', color: '#0B2F6B', fontSize: 11, fontWeight: 800 }}>{invoice.signature ? 'Recipient signature captured in XDrive' : 'POD status recorded in XDrive'}</div>
        </section>

        <section className="invoice-no-break" style={section}>
          <div style={kicker}>Charges</div>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 110px 110px 120px', background: '#0B2F6B', color: '#fff', borderRadius: '9px 9px 0 0', padding: '10px 8px', fontSize: 11, fontWeight: 800 }}>
            <span>Qty</span><span>Description</span><span>Net</span><span>VAT</span><span>Total</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 110px 110px 120px', border: '1px solid #e4e7ec', borderTop: 0, borderRadius: '0 0 9px 9px', padding: '12px 8px', fontSize: 12, fontWeight: 700 }}>
            <span>1</span><span>{invoice.serviceDescription || 'Transport service'}</span><span>{money(invoice.netAmount)}</span><span>{money(invoice.vatAmount)} ({invoice.vatRate}%)</span><span>{money(invoice.amount)}</span>
          </div>
        </section>

        <div className="invoice-no-break" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <section style={{ ...section, background: '#f8fafc' }}>
            <div style={kicker}>Payment</div>
            <strong>Please ensure payment is received by {fmtDate(invoice.dueDate)}.</strong>
            <div style={{ ...muted, marginTop: 6 }}>Payment terms: {invoice.paymentTerms}</div>
            <div style={{ ...muted, marginTop: 8 }}>{bankName && bankSort && bankAccount ? `Account: ${bankName} · Sort code: ${bankSort} · Account no: ${bankAccount}` : 'Bank details are available from the invoice issuer.'}</div>
            <div style={{ ...muted, fontSize: 10, marginTop: 8 }}>{invoice.lateFee}</div>
          </section>
          <section style={section}>
            {[['Subtotal', money(invoice.netAmount)], ['VAT', money(invoice.vatAmount)]].map(([k,v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>{k}</span><strong>{v}</strong></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d0d5dd', paddingTop: 10, color: '#0B2F6B', fontSize: 17, fontWeight: 900 }}><span>TOTAL</span><span>{money(invoice.amount)}</span></div>
          </section>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid #e4e7ec', padding: '12px 18px 16px', textAlign: 'center', color: '#667085', fontSize: 10 }}>
        {smallMeta([
          issuerName,
          invoice.issuerCompanyNumber ? `Company No. ${invoice.issuerCompanyNumber}` : undefined,
          invoice.issuerVatNumber ? `VAT ${invoice.issuerVatNumber}` : undefined,
          invoice.issuerXdId ? `XDrive ID ${invoice.issuerXdId}` : undefined,
          invoice.issuerEmail || companySettings.email,
          invoice.issuerPhone || companySettings.phone,
        ])}
      </footer>
    </div>
  );
}
