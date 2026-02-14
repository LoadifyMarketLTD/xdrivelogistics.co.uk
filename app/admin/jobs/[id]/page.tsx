'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { COMPANY_CONFIG, JOB_STATUS } from '../../../config/company';

interface Job {
  id: string;
  jobRef: string;
  client: {
    name: string;
    email: string;
    phone: string;
  };
  pickup: {
    location: string;
    date: string;
    time: string;
  };
  delivery: {
    location: string;
    date: string;
    time: string;
  };
  cargo: {
    type: string;
    quantity: number;
    notes: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
  }>;
  pod?: {
    pickupPhotos?: string[];
    deliveryPhotos?: string[];
    signature?: string;
    recipientName?: string;
    timestamp?: string;
  };
}

const CARGO_TYPES = [
  'Documents',
  'Packages',
  'Pallets',
  'Furniture',
  'Equipment',
  'Other'
];

const STATUS_OPTIONS = Object.values(JOB_STATUS);

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Job | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = () => {
    try {
      const stored = localStorage.getItem('xdrive_jobs');
      if (stored) {
        const jobs: Job[] = JSON.parse(stored);
        const foundJob = jobs.find((j) => j.id === jobId);
        if (foundJob) {
          setJob(foundJob);
          setFormData(foundJob);
        } else {
          setSaveMessage('Job not found');
        }
      } else {
        setSaveMessage('Job not found');
      }
    } catch (error) {
      console.error('Error loading job:', error);
      setSaveMessage('Error loading job');
    }
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancel = () => {
    setFormData(job);
    setEditMode(false);
  };

  const handleSave = () => {
    if (!formData) return;

    try {
      const stored = localStorage.getItem('xdrive_jobs');
      if (stored) {
        let jobs: Job[] = JSON.parse(stored);
        
        // Check if status changed
        const oldJob = jobs.find(j => j.id === jobId);
        const statusChanged = oldJob && oldJob.status !== formData.status;
        
        // Update status history if status changed
        if (statusChanged) {
          const statusHistory = formData.statusHistory || [];
          statusHistory.push({
            status: formData.status,
            timestamp: new Date().toISOString()
          });
          formData.statusHistory = statusHistory;
        }
        
        // Update timestamp
        formData.updatedAt = new Date().toISOString();
        
        jobs = jobs.map((j) => (j.id === jobId ? formData : j));
        localStorage.setItem('xdrive_jobs', JSON.stringify(jobs));
        
        setJob(formData);
        setEditMode(false);
        setSaveMessage('Job saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving job:', error);
      setSaveMessage('Error saving job. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleDelete = () => {
    try {
      const stored = localStorage.getItem('xdrive_jobs');
      if (stored) {
        let jobs: Job[] = JSON.parse(stored);
        jobs = jobs.filter((j) => j.id !== jobId);
        localStorage.setItem('xdrive_jobs', JSON.stringify(jobs));
        router.push('/admin/jobs');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      setSaveMessage('Error deleting job. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleGenerateInvoice = () => {
    if (!job) return;
    
    // Create a new invoice with job data pre-filled
    const invoiceData = {
      id: `invoice_${Date.now()}`,
      jobRef: job.jobRef,
      clientName: job.client.name,
      clientEmail: job.client.email,
      pickupLocation: job.pickup.location,
      pickupDateTime: `${job.pickup.date}T${job.pickup.time}`,
      deliveryLocation: job.delivery.location,
      deliveryDateTime: `${job.delivery.date}T${job.delivery.time}`,
      serviceDescription: `${job.cargo.type} delivery - ${job.cargo.quantity} unit(s)`,
    };
    
    // Store temp invoice data
    localStorage.setItem('temp_invoice_data', JSON.stringify(invoiceData));
    
    // Navigate to new invoice page
    router.push('/admin/invoices/new');
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = {
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'inline-block',
    };

    switch (status) {
      case JOB_STATUS.RECEIVED:
        return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' };
      case JOB_STATUS.POSTED:
        return { ...baseStyle, backgroundColor: '#dbeafe', color: '#1e3a8a' };
      case JOB_STATUS.ALLOCATED:
        return { ...baseStyle, backgroundColor: '#e9d5ff', color: '#581c87' };
      case JOB_STATUS.DELIVERED:
        return { ...baseStyle, backgroundColor: '#dcfce7', color: '#14532d' };
      default:
        return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#1f2937' };
    }
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

  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  if (!job || !formData) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            {saveMessage || 'Loading...'}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: '#0A2239',
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
                  Job Details
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
                  {job.jobRef} • {editMode ? 'Edit Mode' : 'View Mode'}
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/jobs')}
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
                ← Back to Jobs
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
          {/* Actions Bar */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!editMode ? (
                <>
                  <button
                    onClick={handleEdit}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#1F7A3D',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#165a2d')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1F7A3D')}
                  >
                    ✏️ Edit Job
                  </button>
                  <button
                    onClick={handleGenerateInvoice}
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
                    📄 Generate Invoice
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                  >
                    🗑️ Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#1F7A3D',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#165a2d')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1F7A3D')}
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
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
                    ✖️ Cancel
                  </button>
                </>
              )}
            </div>
            {saveMessage && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: saveMessage.includes('Error') || saveMessage.includes('not found') ? '#fee2e2' : '#d1fae5',
                  color: saveMessage.includes('Error') || saveMessage.includes('not found') ? '#991b1b' : '#065f46',
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

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '2rem',
                  borderRadius: '12px',
                  maxWidth: '400px',
                  width: '90%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem 0', color: '#dc2626', fontSize: '1.25rem', fontWeight: '700' }}>
                  Confirm Delete
                </h3>
                <p style={{ margin: '0 0 1.5rem 0', color: '#374151' }}>
                  Are you sure you want to delete job {job.jobRef}? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Delete Job
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Job Header */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
                  {formData.jobRef}
                </h2>
                <p style={{ margin: '0 0 0.25rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Created: {new Date(formData.createdAt).toLocaleString('en-GB')}
                </p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  Last Updated: {new Date(formData.updatedAt).toLocaleString('en-GB')}
                </p>
              </div>
              <div>
                {editMode ? (
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={inputStyle}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={getStatusBadgeStyle(formData.status)}>
                    {formData.status}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
              Client Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Name</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.client.name}
                    onChange={(e) => setFormData({ ...formData, client: { ...formData.client, name: e.target.value } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.client.name}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                {editMode ? (
                  <input
                    type="email"
                    value={formData.client.email}
                    onChange={(e) => setFormData({ ...formData, client: { ...formData.client, email: e.target.value } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.client.email}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                {editMode ? (
                  <input
                    type="tel"
                    value={formData.client.phone}
                    onChange={(e) => setFormData({ ...formData, client: { ...formData.client, phone: e.target.value } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.client.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pickup Details */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
              📍 Pickup Details
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Location</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.pickup.location}
                    onChange={(e) => setFormData({ ...formData, pickup: { ...formData.pickup, location: e.target.value } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.pickup.location}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  {editMode ? (
                    <input
                      type="date"
                      value={formData.pickup.date}
                      onChange={(e) => setFormData({ ...formData, pickup: { ...formData.pickup, date: e.target.value } })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  ) : (
                    <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                      {new Date(formData.pickup.date).toLocaleDateString('en-GB')}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  {editMode ? (
                    <input
                      type="time"
                      value={formData.pickup.time}
                      onChange={(e) => setFormData({ ...formData, pickup: { ...formData.pickup, time: e.target.value } })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  ) : (
                    <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                      {formData.pickup.time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Details */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
              🎯 Delivery Details
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Location</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.delivery.location}
                    onChange={(e) => setFormData({ ...formData, delivery: { ...formData.delivery, location: e.target.value } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.delivery.location}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  {editMode ? (
                    <input
                      type="date"
                      value={formData.delivery.date}
                      onChange={(e) => setFormData({ ...formData, delivery: { ...formData.delivery, date: e.target.value } })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  ) : (
                    <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                      {new Date(formData.delivery.date).toLocaleDateString('en-GB')}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  {editMode ? (
                    <input
                      type="time"
                      value={formData.delivery.time}
                      onChange={(e) => setFormData({ ...formData, delivery: { ...formData.delivery, time: e.target.value } })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  ) : (
                    <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                      {formData.delivery.time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cargo Details */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
              📦 Cargo Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Type</label>
                {editMode ? (
                  <select
                    value={formData.cargo.type}
                    onChange={(e) => setFormData({ ...formData, cargo: { ...formData.cargo, type: e.target.value } })}
                    style={inputStyle}
                  >
                    {CARGO_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.cargo.type}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Quantity</label>
                {editMode ? (
                  <input
                    type="number"
                    min="1"
                    value={formData.cargo.quantity}
                    onChange={(e) => setFormData({ ...formData, cargo: { ...formData.cargo, quantity: parseInt(e.target.value) || 1 } })}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                ) : (
                  <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                    {formData.cargo.quantity}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Notes</label>
              {editMode ? (
                <textarea
                  value={formData.cargo.notes}
                  onChange={(e) => setFormData({ ...formData, cargo: { ...formData.cargo, notes: e.target.value } })}
                  rows={3}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  placeholder="Additional notes about the cargo"
                />
              ) : (
                <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                  {formData.cargo.notes || 'No additional notes'}
                </div>
              )}
            </div>
          </div>

          {/* Status History */}
          {formData.statusHistory && formData.statusHistory.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                📋 Status History
              </h2>
              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                {/* Timeline line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '0.5rem',
                    top: '0.5rem',
                    bottom: '0.5rem',
                    width: '2px',
                    backgroundColor: '#e5e7eb',
                  }}
                />
                {formData.statusHistory.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      paddingBottom: index < formData.statusHistory!.length - 1 ? '1.5rem' : '0',
                    }}
                  >
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-1.5rem',
                        top: '0.25rem',
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '50%',
                        backgroundColor: index === formData.statusHistory!.length - 1 ? '#1F7A3D' : '#3b82f6',
                        border: '3px solid white',
                        boxShadow: '0 0 0 2px #e5e7eb',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={getStatusBadgeStyle(item.status)}>
                        {item.status}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {new Date(item.timestamp).toLocaleString('en-GB')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof of Delivery (POD) */}
          {formData.pod && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                ✅ Proof of Delivery
              </h2>

              {/* Pickup Photos */}
              {formData.pod.pickupPhotos && formData.pod.pickupPhotos.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                    Pickup Photos
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    {formData.pod.pickupPhotos.map((photo, index) => (
                      <div
                        key={index}
                        style={{
                          position: 'relative',
                          paddingBottom: '100%',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <img
                          src={photo}
                          alt={`Pickup photo ${index + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Photos */}
              {formData.pod.deliveryPhotos && formData.pod.deliveryPhotos.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                    Delivery Photos
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    {formData.pod.deliveryPhotos.map((photo, index) => (
                      <div
                        key={index}
                        style={{
                          position: 'relative',
                          paddingBottom: '100%',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <img
                          src={photo}
                          alt={`Delivery photo ${index + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature */}
              {formData.pod.signature && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                    Signature
                  </h3>
                  <div
                    style={{
                      backgroundColor: '#f9fafb',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '1rem',
                      maxWidth: '400px',
                    }}
                  >
                    <img
                      src={formData.pod.signature}
                      alt="Recipient signature"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Recipient Info */}
              {(formData.pod.recipientName || formData.pod.timestamp) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {formData.pod.recipientName && (
                    <div>
                      <label style={labelStyle}>Recipient Name</label>
                      <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                        {formData.pod.recipientName}
                      </div>
                    </div>
                  )}
                  {formData.pod.timestamp && (
                    <div>
                      <label style={labelStyle}>POD Timestamp</label>
                      <div style={{ padding: '0.75rem 0', fontSize: '0.95rem', color: '#1f2937' }}>
                        {new Date(formData.pod.timestamp).toLocaleString('en-GB')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
