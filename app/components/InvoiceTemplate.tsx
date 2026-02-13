'use client';

import React from 'react';
import { COMPANY_CONFIG } from '../config/company';

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  jobRef: string;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
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
  paymentTerms: '14 days' | '30 days';
  lateFee: string;
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  showPreview?: boolean;
}

export default function InvoiceTemplate({ invoice, showPreview = false }: InvoiceTemplateProps) {
  const containerStyle: React.CSSProperties = {
    backgroundColor: 'white',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '2rem',
    marginBottom: '2rem',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '0 2rem',
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '0.25rem',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#1f2937',
    marginBottom: '1rem',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '1rem',
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: '#f3f4f6',
    padding: '0.75rem',
    textAlign: 'left',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '2px solid #e5e7eb',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderBottom: '1px solid #e5e7eb',
    color: '#1f2937',
  };

  const totalSectionStyle: React.CSSProperties = {
    backgroundColor: '#f9fafb',
    padding: '1.5rem 2rem',
    marginTop: '2rem',
  };

  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      .invoice-print-area, .invoice-print-area * {
        visibility: visible;
      }
      .invoice-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      button, .no-print {
        display: none !important;
      }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <div className="invoice-print-area" style={containerStyle}>
        {/* Header with Blue Band */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                {COMPANY_CONFIG.name}
              </h1>
              <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
                {COMPANY_CONFIG.tagline}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                INVOICE
              </div>
              <div style={{ opacity: 0.9 }}>
                {invoice.invoiceNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={labelStyle}>Invoice Date</div>
              <div style={valueStyle}>{new Date(invoice.date).toLocaleDateString('en-GB')}</div>
            </div>
            <div>
              <div style={labelStyle}>Due Date</div>
              <div style={valueStyle}>{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</div>
            </div>
            <div>
              <div style={labelStyle}>Job Reference</div>
              <div style={valueStyle}>{invoice.jobRef}</div>
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <div style={{
                ...valueStyle,
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '600',
                backgroundColor: 
                  invoice.status === 'Paid' ? '#d1fae5' :
                  invoice.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                color:
                  invoice.status === 'Paid' ? '#065f46' :
                  invoice.status === 'Pending' ? '#92400e' : '#991b1b',
              }}>
                {invoice.status}
              </div>
            </div>
          </div>
        </div>

        {/* Client Details */}
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Bill To</div>
          <div style={{ ...valueStyle, marginBottom: '0.25rem', fontWeight: '600' }}>
            {invoice.clientName}
          </div>
          <div style={{ ...valueStyle, marginBottom: '0.25rem', whiteSpace: 'pre-line' }}>
            {invoice.clientAddress}
          </div>
          <div style={valueStyle}>
            {invoice.clientEmail}
          </div>
        </div>

        {/* Service Details */}
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, fontSize: '1rem', marginBottom: '1rem' }}>Service Details</div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={labelStyle}>Pickup</div>
            <div style={valueStyle}>
              <div>{invoice.pickupLocation}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {new Date(invoice.pickupDateTime).toLocaleString('en-GB')}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={labelStyle}>Delivery</div>
            <div style={valueStyle}>
              <div>{invoice.deliveryLocation}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {new Date(invoice.deliveryDateTime).toLocaleString('en-GB')}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Recipient: {invoice.deliveryRecipient}
              </div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Description</div>
            <div style={valueStyle}>{invoice.serviceDescription}</div>
          </div>
        </div>

        {/* Amount Table */}
        <div style={sectionStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Courier Service</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>£{invoice.amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total Section */}
        <div style={totalSectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              Total Amount Due
            </span>
            <span style={{ fontSize: '1.75rem', fontWeight: '700', color: '#2563eb' }}>
              £{invoice.amount.toFixed(2)}
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Payment Terms: {invoice.paymentTerms}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '500' }}>
            {invoice.lateFee}
          </div>
        </div>

        {/* Payment Details */}
        <div style={{ ...sectionStyle, borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem', marginTop: '2rem' }}>
          <div style={{ ...labelStyle, fontSize: '1rem', marginBottom: '1rem' }}>Payment Information</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={{ ...labelStyle, fontSize: '0.875rem' }}>Bank Transfer</div>
              <div style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: '1.6' }}>
                <div>{COMPANY_CONFIG.payment.bankTransfer.accountName}</div>
                <div>Sort Code: {COMPANY_CONFIG.payment.bankTransfer.sortCode}</div>
                <div>Account: {COMPANY_CONFIG.payment.bankTransfer.accountNumber}</div>
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: '0.875rem' }}>PayPal</div>
              <div style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                {COMPANY_CONFIG.payment.paypal.email}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ ...sectionStyle, textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem', borderTop: '1px solid #e5e7eb', marginTop: '2rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            Thank you for your business!
          </p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>
            For any queries, please contact us at {COMPANY_CONFIG.email}
          </p>
        </div>
      </div>
    </>
  );
}
