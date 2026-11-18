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
  documentType?: 'invoice' | 'supplementary' | 'credit_note';
  parentInvoiceNumber?: string;
  adjustmentReason?: string;
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
  issuerLogoUrl?: string;
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
    ? d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' });
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
  const documentLabel = invoice.documentType === 'credit_note' ? 'CREDIT NOTE' : invoice.documentType === 'supplementary' ? 'SUPPLEMENTARY INVOICE' : 'INVOICE';
  const signedNetAmount = invoice.documentType === 'credit_note' ? -Math.abs(invoice.netAmount) : invoice.netAmount;
  const signedVatAmount = invoice.documentType === 'credit_note' ? -Math.abs(invoice.vatAmount) : invoice.vatAmount;
  const signedTotalAmount = invoice.documentType === 'credit_note' ? -Math.abs(invoice.amount) : invoice.amount;
  const recipient = invoice.deliveryRecipient || invoice.recipientName || 'Not supplied';
  const evidence = (invoice.podPhotos || []).filter(Boolean).slice(0, 4);
  const issuerMeta = [
    invoice.issuerCompanyNumber ? `Company No. ${invoice.issuerCompanyNumber}` : '',
    invoice.issuerVatNumber ? `VAT ${invoice.issuerVatNumber}` : '',
  ].filter(Boolean).join(' · ');

  const navy = '#062b55';
  const soft = '#eef2f7';
  const line = '#d7dee8';
  const muted = '#4b5563';
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: '#4d5d70', textTransform: 'uppercase', letterSpacing: '.2px' };

  return (
    <article className="invoice-print-area invoice-a4-reference">
      <style>{`
        .invoice-a4-reference{width:210mm;min-height:297mm;max-width:210mm;margin:0 auto;background:#fff;color:#101827;padding:14mm 13mm 11mm;box-sizing:border-box;border:1px solid #e4e8ef;box-shadow:0 10px 30px rgba(15,23,42,.10);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;position:relative;overflow:hidden;font-size:11pt}
        .invoice-a4-reference *{box-sizing:border-box}.invoice-no-break{break-inside:avoid;page-break-inside:avoid}
        @media print{html,body{background:#fff!important}.invoice-a4-reference{width:210mm!important;height:297mm!important;max-width:none!important;margin:0!important;border:0!important;box-shadow:none!important;overflow:hidden!important}}
      `}</style>

      <div className="invoice-no-break" style={{ display: 'grid', gridTemplateColumns: '1fr .88fr', gap: '18mm', alignItems: 'start', marginBottom: '11mm' }}>
        <section>
          {invoice.issuerLogoUrl ? (
            <img src={invoice.issuerLogoUrl} alt="" style={{ display: 'block', maxWidth: 180, maxHeight: 62, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <h2 style={{ fontSize: 26, lineHeight: 1.05, margin: '0 0 14px', color: '#101827' }}>{issuerName}</h2>
          )}
          <p style={{ margin: '0 0 10px', lineHeight: 1.45 }}>{issuerAddress || 'Address not supplied'}</p>
          {issuerMeta && <p style={{ margin: '0 0 10px', color: muted }}>{issuerMeta}</p>}
          {(invoice.issuerEmail || companySettings.email) && <p style={{ margin: '0 0 5px' }}><b>Email:</b> {invoice.issuerEmail || companySettings.email}</p>}
          {(invoice.issuerPhone || companySettings.phone) && <p style={{ margin: 0 }}><b>Tel:</b> {invoice.issuerPhone || companySettings.phone}</p>}
        </section>

        <section style={{ display: 'grid', gap: '5mm' }}>
          <div style={{ background: soft, borderRadius: 6, padding: '4mm 6mm' }}>
            {[
              ['DATE', fmtDate(invoice.date)],
              ['JOB REF', invoice.jobRef || invoice.loadId || '—'],
              ['INVOICE#', invoice.invoiceNumber],
            ].map(([k,v], index) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '8px 0', borderBottom: index < 2 ? '1px solid #cfd7e3' : 0 }}>
                <b style={label}>{k}</b><span style={{ textAlign: 'right', fontWeight: k === 'INVOICE#' ? 800 : 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: soft, borderRadius: 6, padding: '7mm 6mm', minHeight: '29mm' }}>
            <b style={{ display: 'block', marginBottom: 8 }}>Invoice to:</b>
            <h3 style={{ fontSize: 20, margin: '0 0 7px' }}>{invoice.clientName || 'Not supplied'}</h3>
            <p style={{ margin: '0 0 5px', lineHeight: 1.35 }}>{invoice.clientAddress || 'Address not supplied'}</p>
            {invoice.clientEmail && <p style={{ margin: 0, color: muted }}>{invoice.clientEmail}</p>}
          </div>
        </section>
      </div>

      <div className="invoice-no-break" style={{ width: '86mm', background: navy, color: '#fff', fontSize: 30, fontWeight: 900, padding: '5mm 7mm 4.5mm', lineHeight: 1, marginBottom: 0 }}>{documentLabel}</div>

      {invoice.documentType && invoice.documentType !== 'invoice' && (
        <div className="invoice-no-break" style={{ border: `1px solid ${line}`, background: '#fff7ed', padding: '10px 14px', marginBottom: 8 }}>
          <b>{invoice.documentType === 'credit_note' ? 'Credit adjustment' : 'Supplementary charge'}</b>
          <span style={{ marginLeft: 12 }}>{invoice.parentInvoiceNumber || 'Referenced parent invoice'}{invoice.adjustmentReason ? ` · ${invoice.adjustmentReason}` : ''}</span>
        </div>
      )}

      <table className="invoice-no-break" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', margin: 0 }}>
        <tbody>
          <tr><th colSpan={3} style={{ background: navy, color: '#fff', textAlign: 'left', padding: '4mm 6mm', fontSize: 17 }}>PICKUP</th></tr>
          <tr>
            <td style={{ width: '45mm', border: `1px solid ${line}`, padding: '4mm 6mm', background: '#fbfcfe' }}><b>Location</b></td>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{invoice.pickupLocation || 'Not supplied'}</td>
            <td style={{ width: '48mm', border: `1px solid ${line}`, padding: '4mm 6mm', textAlign: 'center', fontWeight: 700 }}>{invoice.noOfItems != null ? `${invoice.noOfItems} item(s)` : invoice.cargoSummary || 'Cargo'}</td>
          </tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm', background: '#fbfcfe' }}><b>Cargo Details</b></td>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{invoice.cargoSummary || invoice.serviceDescription || 'Transport service'}</td>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{fmtDate(invoice.pickupDateTime, true)}</td>
          </tr>
          <tr><th colSpan={3} style={{ background: navy, color: '#fff', textAlign: 'left', padding: '4mm 6mm', fontSize: 17 }}>DELIVERY</th></tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm', background: '#fbfcfe' }}><b>Location</b></td>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{invoice.deliveryLocation || 'Not supplied'}</td>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{fmtDate(invoice.deliveryDateTime, true)}</td>
          </tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '4mm 6mm', background: '#fbfcfe' }}><b>Recipient</b></td>
            <td colSpan={2} style={{ border: `1px solid ${line}`, padding: '4mm 6mm' }}>{recipient}</td>
          </tr>
        </tbody>
      </table>

      <div className="invoice-no-break" style={{ marginTop: '4.5mm' }}><b style={label}>Proof of Delivery</b></div>
      <div className="invoice-no-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '3mm', margin: '2mm 0 4mm' }}>
        {[0,1,2,3].map((index) => (
          <div key={index} style={{ height: '31mm', background: soft, border: `1px solid ${line}`, display: 'grid', placeItems: 'center', overflow: 'hidden', color: '#687586', fontWeight: 800, fontSize: 12, textAlign: 'center' }}>
            {evidence[index] ? <img src={evidence[index]} alt="POD evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{['Vehicle','Cargo','Delivery','Signature / POD'][index]}</span>}
          </div>
        ))}
      </div>

      <div className="invoice-no-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '5mm 6mm', marginBottom: '5mm' }}>
        <div><small style={{ display: 'block', color: muted, marginBottom: 5 }}>Delivery by</small><span>{recipient}</span></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}><b>PAYABLE</b><strong style={{ fontSize: 34, color: navy }}>{money(signedTotalAmount)}</strong></div>
      </div>

      <table className="invoice-no-break" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          <tr><th colSpan={2} style={{ textAlign: 'left', border: `1px solid ${line}`, padding: '5mm 6mm', fontSize: 19 }}>Payment Details</th></tr>
          <tr><td colSpan={2} style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm', background: '#f8fafc' }}><b>Bank Transfer</b> (Preferred Method)</td></tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>Account Name:</b> {bankName || 'Available from issuer'}</td>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>Sort code:</b> {bankSort || '—'}</td>
          </tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>Account Number:</b> {bankAccount || '—'}</td>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>VAT:</b> {money(signedVatAmount)} ({invoice.vatRate}%)</td>
          </tr>
          <tr>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>Subtotal:</b> {money(signedNetAmount)}</td>
            <td style={{ border: `1px solid ${line}`, padding: '3.6mm 6mm' }}><b>Status:</b> {status}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: 12, color: muted, margin: '4mm 0 0' }}>Payment terms: {invoice.paymentTerms}. Please ensure payment is received by {fmtDate(invoice.dueDate)}.{invoice.lateFee ? ` ${invoice.lateFee}` : ''}</p>

      <footer style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: navy, color: '#fff', padding: '5mm 13mm', fontSize: 11.5, lineHeight: 1.45 }}>
        <b>{issuerName}</b> | {issuerAddress || 'Address not supplied'}<br />
        {[invoice.issuerEmail || companySettings.email, invoice.issuerPhone || companySettings.phone].filter(Boolean).join(' | ')}
      </footer>
    </article>
  );
}
