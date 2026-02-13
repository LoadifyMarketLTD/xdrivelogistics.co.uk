'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import InvoiceTemplate, { InvoiceData } from '../../../components/InvoiceTemplate';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string;
  const isNew = invoiceId === 'new';

  const [formData, setFormData] = useState<InvoiceData>({
    id: '',
    invoiceNumber: '',
    jobRef: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'Pending',
    clientName: '',
    clientAddress: '',
    clientEmail: '',
    pickupLocation: '',
    pickupDateTime: '',
    deliveryLocation: '',
    deliveryDateTime: '',
    deliveryRecipient: '',
    serviceDescription: '',
    amount: 0,
    paymentTerms: '14 days',
    lateFee: 'Late fee: £25 per full week overdue after due date',
  });

  const [showPreview, setShowPreview] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!isNew) {
      loadInvoice();
    } else {
      generateNewInvoiceData();
    }
  }, [invoiceId]);

  useEffect(() => {
    if (formData.date && formData.paymentTerms) {
      const invoiceDate = new Date(formData.date);
      const daysToAdd = formData.paymentTerms === '14 days' ? 14 : 30;
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + daysToAdd);
      setFormData((prev) => ({
        ...prev,
        dueDate: dueDate.toISOString().split('T')[0],
      }));
    }
  }, [formData.date, formData.paymentTerms]);

  const generateJobRef = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const xxxx = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `DC-${yy}${mm}${dd}-${xxxx}`;
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  const generateNewInvoiceData = () => {
    const id = `invoice_${Date.now()}`;
    const jobRef = generateJobRef();
    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    setFormData((prev) => ({
      ...prev,
      id,
      jobRef,
      invoiceNumber,
      dueDate: dueDate.toISOString().split('T')[0],
    }));
  };

  const loadInvoice = () => {
    try {
      const stored = localStorage.getItem('dannycourier_invoices');
      if (stored) {
        const invoices: InvoiceData[] = JSON.parse(stored);
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          setFormData(invoice);
        } else {
          router.push('/admin/invoices');
        }
      } else {
        router.push('/admin/invoices');
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      router.push('/admin/invoices');
    }
  };

  const handleSave = () => {
    try {
      const stored = localStorage.getItem('dannycourier_invoices');
      let invoices: InvoiceData[] = stored ? JSON.parse(stored) : [];

      if (isNew) {
        invoices.push(formData);
      } else {
        invoices = invoices.map((inv) => (inv.id === invoiceId ? formData : inv));
      }

      localStorage.setItem('dannycourier_invoices', JSON.stringify(invoices));
      setSaveMessage('Invoice saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);

      if (isNew) {
        setTimeout(() => {
          router.push(`/admin/invoices/${formData.id}`);
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      setSaveMessage('Error saving invoice. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `Invoice ${formData.invoiceNumber}\n` +
      `Job Ref: ${formData.jobRef}\n` +
      `Amount: £${formData.amount.toFixed(2)}\n` +
      `Due Date: ${new Date(formData.dueDate).toLocaleDateString('en-GB')}\n\n` +
      `Please make payment via:\n` +
      `Bank Transfer: Sort Code 04-00-04, Account 12345678\n` +
      `PayPal: xdrivelogisticsltd@gmail.com`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1e293b',
            color: 'white',
            padding: '1.5rem 2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
                  {isNew ? 'Create New Invoice' : 'Edit Invoice'}
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
                  {isNew ? 'Fill in the details below' : `Invoice ${formData.invoiceNumber}`}
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/invoices')}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
              >
                ← Back to Invoices
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: '2rem' }}>
            {/* Form Section */}
            <div>
              {/* Action Buttons */}
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  marginBottom: '1.5rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSave}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
                  >
                    💾 Save Invoice
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                  >
                    👁️ {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                  <button
                    onClick={handlePrint}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4b5563')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6b7280')}
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#25d366',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#20ba5a')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#25d366')}
                  >
                    📱 WhatsApp
                  </button>
                </div>
                {saveMessage && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: saveMessage.includes('Error') ? '#fee2e2' : '#d1fae5',
                      color: saveMessage.includes('Error') ? '#991b1b' : '#065f46',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textAlign: 'center',
                    }}
                  >
                    {saveMessage}
                  </div>
                )}
              </div>

              {/* Invoice Details Form */}
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                  Invoice Details
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Job Reference</label>
                    <input
                      type="text"
                      value={formData.jobRef}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Terms</label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as '14 days' | '30 days' })}
                      style={inputStyle}
                    >
                      <option value="14 days">14 days</option>
                      <option value="30 days">30 days</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      style={inputStyle}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Client Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Client Name</label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      placeholder="Client Name"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Address</label>
                    <textarea
                      value={formData.clientAddress}
                      onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                      placeholder="Full address"
                      rows={3}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Email</label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      placeholder="client@example.com"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Pickup Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Pickup Location</label>
                    <input
                      type="text"
                      value={formData.pickupLocation}
                      onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                      placeholder="Pickup address"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Pickup Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.pickupDateTime}
                      onChange={(e) => setFormData({ ...formData, pickupDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Delivery Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Delivery Location</label>
                    <input
                      type="text"
                      value={formData.deliveryLocation}
                      onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                      placeholder="Delivery address"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.deliveryDateTime}
                      onChange={(e) => setFormData({ ...formData, deliveryDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Recipient</label>
                    <input
                      type="text"
                      value={formData.deliveryRecipient}
                      onChange={(e) => setFormData({ ...formData, deliveryRecipient: e.target.value })}
                      placeholder="Recipient name"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Service & Payment
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Service Description</label>
                    <textarea
                      value={formData.serviceDescription}
                      onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                      placeholder="Description of courier service provided"
                      rows={3}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Amount Payable (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            {showPreview && (
              <div>
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '1.5rem', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                      Invoice Preview
                    </h2>
                  </div>
                  <div style={{ padding: '1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                    <InvoiceTemplate invoice={formData} showPreview={true} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
