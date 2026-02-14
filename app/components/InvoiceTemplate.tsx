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
  paymentTerms: 'Pay now' | '14 days' | '30 days';
  lateFee: string;
  vatRate: 0 | 5 | 20;
  netAmount: number;
  vatAmount: number;
  podPhotos?: string[];
  signature?: string;
  recipientName?: string;
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  showPreview?: boolean;
}

export default function InvoiceTemplate({ invoice, showPreview = false }: InvoiceTemplateProps) {
  // Calculate payment due date based on payment terms
  const calculateDueDate = (invoiceDate: string, terms: string): Date => {
    const date = new Date(invoiceDate);
    if (terms === 'Pay now') {
      return date;
    } else if (terms === '14 days') {
      date.setDate(date.getDate() + 14);
    } else if (terms === '30 days') {
      date.setDate(date.getDate() + 30);
    }
    return date;
  };

  const paymentDueDate = calculateDueDate(invoice.date, invoice.paymentTerms);
  
  const containerStyle: React.CSSProperties = {
    backgroundColor: 'white',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#0A2239',
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
      .pod-photo {
        max-width: 200px;
        page-break-inside: avoid;
      }
      .pod-section {
        page-break-inside: avoid;
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

        {/* VAT Breakdown */}
        <div style={{ ...sectionStyle, backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem' }}>
          <div style={{ ...labelStyle, fontSize: '1rem', marginBottom: '1rem', color: '#0A2239' }}>VAT Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem', color: '#374151' }}>Net Amount</span>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
                £{invoice.netAmount.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem', color: '#374151' }}>VAT ({invoice.vatRate}%)</span>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
                £{invoice.vatAmount.toFixed(2)}
              </span>
            </div>
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0A2239' }}>Total Amount</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1F7A3D' }}>
                £{invoice.amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Terms & Due Date */}
        <div style={{ ...sectionStyle, backgroundColor: '#fef3c7', padding: '1.5rem', borderRadius: '8px', marginTop: '1.5rem', border: '2px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ ...labelStyle, color: '#92400e', marginBottom: '0.5rem' }}>Payment Terms</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#92400e' }}>
                {invoice.paymentTerms}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...labelStyle, color: '#92400e', marginBottom: '0.5rem' }}>Payment Due Date</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#92400e' }}>
                {paymentDueDate.toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#92400e', marginTop: '1rem', fontWeight: '500' }}>
            {COMPANY_CONFIG.payment.lateFeeAmount}
          </div>
        </div>

        {/* Payment Details */}
        <div style={{ ...sectionStyle, borderTop: '2px solid #0A2239', paddingTop: '1.5rem', marginTop: '2rem' }}>
          <div style={{ ...labelStyle, fontSize: '1.1rem', marginBottom: '1rem', color: '#0A2239' }}>Payment Methods</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            <div style={{ backgroundColor: '#f3f4f6', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ ...labelStyle, fontSize: '0.95rem', color: '#0A2239', marginBottom: '0.75rem' }}>Bank Transfer</div>
              <div style={{ fontSize: '0.95rem', color: '#1f2937', lineHeight: '1.8', fontWeight: '500' }}>
                <div style={{ marginBottom: '0.5rem' }}><strong>{COMPANY_CONFIG.payment.bankTransfer.accountName}</strong></div>
                <div>Sort Code: <strong>{COMPANY_CONFIG.payment.bankTransfer.sortCode}</strong></div>
                <div>Account: <strong>{COMPANY_CONFIG.payment.bankTransfer.accountNumber}</strong></div>
              </div>
            </div>
            <div style={{ backgroundColor: '#f3f4f6', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ ...labelStyle, fontSize: '0.95rem', color: '#0A2239', marginBottom: '0.75rem' }}>PayPal</div>
              <div style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: '500' }}>
                {COMPANY_CONFIG.payment.paypal.email}
              </div>
            </div>
          </div>
        </div>

        {/* Proof of Delivery Section */}
        {(invoice.podPhotos || invoice.signature || invoice.recipientName) && (
          <div className="pod-section" style={{ ...sectionStyle, borderTop: '2px solid #0A2239', paddingTop: '1.5rem', marginTop: '2rem' }}>
            <div style={{ ...labelStyle, fontSize: '1.1rem', marginBottom: '1rem', color: '#0A2239' }}>Proof of Delivery</div>
            
            {invoice.recipientName && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, fontSize: '0.9rem' }}>Received By</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                  {invoice.recipientName}
                </div>
              </div>
            )}

            {invoice.deliveryDateTime && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, fontSize: '0.9rem' }}>Delivered At</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                  {new Date(invoice.deliveryDateTime).toLocaleString('en-GB')}
                </div>
              </div>
            )}

            {invoice.signature && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ ...labelStyle, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Signature</div>
                <img 
                  src={invoice.signature} 
                  alt="Recipient signature" 
                  style={{ 
                    maxWidth: '300px', 
                    maxHeight: '150px', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '4px',
                    backgroundColor: 'white'
                  }} 
                />
              </div>
            )}

            {invoice.podPhotos && invoice.podPhotos.length > 0 && (
              <div>
                <div style={{ ...labelStyle, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Delivery Photos</div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: '1rem' 
                }}>
                  {invoice.podPhotos.map((photo, index) => (
                    <img 
                      key={index}
                      src={photo} 
                      alt={`Delivery photo ${index + 1}`}
                      className="pod-photo"
                      style={{ 
                        width: '100%',
                        maxWidth: '200px',
                        height: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        objectFit: 'cover'
                      }} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
