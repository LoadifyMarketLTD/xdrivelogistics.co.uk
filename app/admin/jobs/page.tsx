'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { COMPANY_CONFIG, JOB_STATUS } from '../../config/company';
import { generateTimeOptions } from '../../utils/timeUtils';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../components/AuthContext';

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
}

const CARGO_TYPES = [
  'Documents',
  'Packages',
  'Pallets',
  'Furniture',
  'Equipment',
  'Other'
];

export default function JobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    pickupLocation: '',
    pickupDate: '',
    pickupTime: '',
    deliveryLocation: '',
    deliveryDate: '',
    deliveryTime: '',
    cargoType: 'Documents',
    cargoQuantity: '1',
    cargoNotes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadJobs();
    if (isSupabaseConfigured && user?.id) {
      // Use get_or_create_company_for_user() which fixes the RLS circular
      // dependency (old memberships_select_member policy blocked 'invited'
      // status users) and auto-provisions a company when none exists.
      supabase
        .rpc('get_or_create_company_for_user')
        .then(({ data, error }) => {
          if (!error && data) {
            setCompanyId(data as string);
          } else {
            if (error) console.error('get_or_create_company_for_user failed:', error.message);
            // Fallback: direct membership query (works after migration 010)
            supabase
              .from('company_memberships')
              .select('company_id')
              .eq('user_id', user.id)
              .neq('status', 'suspended')
              .limit(1)
              .single()
              .then(({ data: mbData }) => { if (mbData) setCompanyId(mbData.company_id as string); });
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    filterJobs();
  }, [jobs, searchTerm, statusFilter]);

  const loadJobs = async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          jobRef: (row.id as string).slice(0, 13).toUpperCase(),
          client: {
            name: (row.load_details as string) || 'Unknown',
            email: '',
            phone: '',
          },
          pickup: {
            location: (row.pickup_location as string) || '',
            date: row.pickup_datetime ? (row.pickup_datetime as string).slice(0, 10) : '',
            time: row.pickup_datetime ? (row.pickup_datetime as string).slice(11, 16) : '',
          },
          delivery: {
            location: (row.delivery_location as string) || '',
            date: row.delivery_datetime ? (row.delivery_datetime as string).slice(0, 10) : '',
            time: row.delivery_datetime ? (row.delivery_datetime as string).slice(11, 16) : '',
          },
          cargo: {
            type: (row.cargo_type as string) || 'Other',
            quantity: (row.items as number) || 1,
            notes: (row.special_requirements as string) || '',
          },
          status: (row.status as string) || JOB_STATUS.RECEIVED,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
        setJobs(mapped);
        return;
      }
    }
    // Fallback to localStorage
    const stored = localStorage.getItem('danny_jobs');
    if (stored) {
      setJobs(JSON.parse(stored));
    } else {
      const sampleJobs: Job[] = [
        {
          id: '1',
          jobRef: 'XD-250214-0001',
          client: {
            name: 'ABC Corporation',
            email: 'contact@abc.com',
            phone: '07123456789'
          },
          pickup: {
            location: 'London, SW1A 1AA',
            date: '2025-02-15',
            time: '09:00'
          },
          delivery: {
            location: 'Manchester, M1 1AE',
            date: '2025-02-15',
            time: '14:00'
          },
          cargo: {
            type: 'Packages',
            quantity: 5,
            notes: 'Fragile items - handle with care'
          },
          status: JOB_STATUS.RECEIVED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          jobRef: 'XD-250214-0002',
          client: {
            name: 'Tech Solutions Ltd',
            email: 'info@techsolutions.com',
            phone: '07987654321'
          },
          pickup: {
            location: 'Birmingham, B1 1AA',
            date: '2025-02-16',
            time: '10:00'
          },
          delivery: {
            location: 'Leeds, LS1 1AA',
            date: '2025-02-16',
            time: '15:00'
          },
          cargo: {
            type: 'Equipment',
            quantity: 2,
            notes: 'Server equipment - urgent delivery'
          },
          status: JOB_STATUS.ALLOCATED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('danny_jobs', JSON.stringify(sampleJobs));
      setJobs(sampleJobs);
    }
  };

  const filterJobs = () => {
    let filtered = jobs;

    if (statusFilter !== 'All') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.jobRef.toLowerCase().includes(term) ||
        job.client.name.toLowerCase().includes(term) ||
        job.pickup.location.toLowerCase().includes(term) ||
        job.delivery.location.toLowerCase().includes(term)
      );
    }

    setFilteredJobs(filtered);
  };

  const generateJobRef = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${COMPANY_CONFIG.invoice.jobRefPrefix}-${year}${month}${day}`;
    
    const existingRefsForToday = jobs
      .filter(job => job.jobRef.startsWith(datePrefix))
      .map(job => parseInt(job.jobRef.split('-')[2]))
      .filter(num => !isNaN(num));
    
    const nextSequence = existingRefsForToday.length > 0 
      ? Math.max(...existingRefsForToday) + 1 
      : 1;
    
    return `${datePrefix}-${String(nextSequence).padStart(4, '0')}`;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.clientName.trim()) errors.clientName = 'Client name is required';
    if (!formData.clientEmail.trim()) errors.clientEmail = 'Client email is required';
    if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      errors.clientEmail = 'Invalid email format';
    }
    if (!formData.clientPhone.trim()) errors.clientPhone = 'Client phone is required';
    if (!formData.pickupLocation.trim()) errors.pickupLocation = 'Pickup location is required';
    if (!formData.pickupDate) errors.pickupDate = 'Pickup date is required';
    if (!formData.pickupTime) errors.pickupTime = 'Pickup time is required';
    if (!formData.deliveryLocation.trim()) errors.deliveryLocation = 'Delivery location is required';
    if (!formData.deliveryDate) errors.deliveryDate = 'Delivery date is required';
    if (!formData.deliveryTime) errors.deliveryTime = 'Delivery time is required';
    if (!formData.cargoQuantity || parseInt(formData.cargoQuantity) < 1) {
      errors.cargoQuantity = 'Quantity must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateJob = async () => {
    if (!validateForm()) return;

    const newJob: Job = {
      id: Date.now().toString(),
      jobRef: generateJobRef(),
      client: {
        name: formData.clientName,
        email: formData.clientEmail,
        phone: formData.clientPhone
      },
      pickup: {
        location: formData.pickupLocation,
        date: formData.pickupDate,
        time: formData.pickupTime
      },
      delivery: {
        location: formData.deliveryLocation,
        date: formData.deliveryDate,
        time: formData.deliveryTime
      },
      cargo: {
        type: formData.cargoType,
        quantity: parseInt(formData.cargoQuantity),
        notes: formData.cargoNotes
      },
      status: JOB_STATUS.RECEIVED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedJobs = [...jobs, newJob];
    if (isSupabaseConfigured) {
      // Resolve companyId — use state value or re-fetch if missing
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_or_create_company_for_user');
        if (rpcData) {
          resolvedCompanyId = rpcData as string;
          setCompanyId(resolvedCompanyId);
        } else {
          console.error('Failed to provision company:', rpcError?.message);
          alert('Unable to load company profile. Please refresh the page and try again.');
          return;
        }
      }
      const { error: insertError } = await supabase.from('jobs').insert([{
        company_id: resolvedCompanyId,
        load_details: formData.clientName,
        pickup_location: formData.pickupLocation,
        pickup_datetime: `${formData.pickupDate}T${formData.pickupTime}:00`,
        delivery_location: formData.deliveryLocation,
        delivery_datetime: `${formData.deliveryDate}T${formData.deliveryTime}:00`,
        cargo_type: formData.cargoType.toLowerCase() as string,
        items: parseInt(formData.cargoQuantity),
        special_requirements: [formData.clientName, formData.clientPhone, formData.clientEmail, formData.cargoNotes].filter(Boolean).join(' | '),
        status: JOB_STATUS.POSTED,
      }]);
      if (insertError) {
        console.error('Failed to create job:', insertError.message);
        alert('Failed to create job. Please check your connection and try again.');
        return;
      }
      setStatusFilter('All');
      await loadJobs();
    } else {
      localStorage.setItem('danny_jobs', JSON.stringify(updatedJobs));
      setJobs(updatedJobs);
    }
    closeModal();
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('jobs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', jobId);
      if (error) {
        console.error('Failed to update job status:', error.message);
        return;
      }
    }
    const updatedJobs = jobs.map(job =>
      job.id === jobId
        ? { ...job, status: newStatus, updatedAt: new Date().toISOString() }
        : job
    );
    localStorage.setItem('danny_jobs', JSON.stringify(updatedJobs));
    setJobs(updatedJobs);
  };

  const handlePostJob = async (jobId: string) => {
    await handleStatusChange(jobId, JOB_STATUS.POSTED);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      pickupLocation: '',
      pickupDate: '',
      pickupTime: '',
      deliveryLocation: '',
      deliveryDate: '',
      deliveryTime: '',
      cargoType: 'Documents',
      cargoQuantity: '1',
      cargoNotes: '',
    });
    setFormErrors({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case JOB_STATUS.RECEIVED:
        return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' };
      case JOB_STATUS.POSTED:
        return { bg: '#dbeafe', text: '#1e3a8a', border: '#5C9FD8' };
      case JOB_STATUS.ALLOCATED:
        return { bg: '#e9d5ff', text: '#581c87', border: '#a855f7' };
      case JOB_STATUS.DELIVERED:
        return { bg: '#dcfce7', text: '#14532d', border: '#1F7A3D' };
      default:
        return { bg: '#f3f4f6', text: '#1f2937', border: '#9ca3af' };
    }
  };

  const getStatusCount = (status: string) => {
    if (status === 'All') return jobs.length;
    return jobs.filter(job => job.status === status).length;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
                Job Management
              </h1>
              <p style={{ color: '#6b7280', margin: 0 }}>
                Manage and track all delivery jobs
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => router.push('/admin')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'white',
                  color: '#0A2239',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#0A2239';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#1F7A3D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}
              >
                + New Job
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {[
            { label: 'All Jobs', status: 'All', icon: '📦', color: '#0A2239' },
            { label: 'Received', status: JOB_STATUS.RECEIVED, icon: '📥', color: '#fbbf24' },
            { label: 'Posted', status: JOB_STATUS.POSTED, icon: '📮', color: '#5C9FD8' },
            { label: 'Allocated', status: JOB_STATUS.ALLOCATED, icon: '🚚', color: '#a855f7' },
            { label: 'Delivered', status: JOB_STATUS.DELIVERED, icon: '✅', color: '#1F7A3D' },
          ].map((stat) => (
            <div
              key={stat.status}
              style={{
                backgroundColor: 'white',
                padding: '1.25rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                borderLeft: `4px solid ${stat.color}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                  {stat.label}
                </div>
                <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                {getStatusCount(stat.status)}
              </div>
            </div>
          ))}
        </div>

        {/* Filters & Search */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by job ref, client, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.95rem',
                width: '100%'
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.95rem',
                backgroundColor: 'white',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="All">All Status</option>
              <option value={JOB_STATUS.RECEIVED}>Received</option>
              <option value={JOB_STATUS.POSTED}>Posted</option>
              <option value={JOB_STATUS.ALLOCATED}>Allocated</option>
              <option value={JOB_STATUS.DELIVERED}>Delivered</option>
            </select>
          </div>
        </div>

        {/* Jobs Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#0A2239', color: 'white' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Job Ref</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Client</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Pickup → Delivery</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>Created Date</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>No jobs found</div>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {searchTerm || statusFilter !== 'All'
                          ? 'Try adjusting your filters'
                          : 'Create your first job to get started'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, index) => {
                    const statusColor = getStatusColor(job.status);
                    return (
                      <tr
                        key={job.id}
                        style={{
                          borderBottom: index < filteredJobs.length - 1 ? '1px solid #e5e7eb' : 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#0A2239', fontSize: '0.9rem' }}>
                          {job.jobRef}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                            {job.client.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {job.client.email}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ color: '#1f2937', fontWeight: '500' }}>
                              📍 {job.pickup.location}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                              {formatDate(job.pickup.date)} at {job.pickup.time}
                            </div>
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0' }}>↓</div>
                          <div>
                            <div style={{ color: '#1f2937', fontWeight: '500' }}>
                              🎯 {job.delivery.location}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                              {formatDate(job.delivery.date)} at {job.delivery.time}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select
                            value={job.status}
                            onChange={(e) => handleStatusChange(job.id, e.target.value)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: statusColor.bg,
                              color: statusColor.text,
                              border: `1px solid ${statusColor.border}`,
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value={JOB_STATUS.RECEIVED}>Received</option>
                            <option value={JOB_STATUS.POSTED}>Posted</option>
                            <option value={JOB_STATUS.ALLOCATED}>Allocated</option>
                            <option value={JOB_STATUS.DELIVERED}>Delivered</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                          {formatDate(job.createdAt)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            {job.status === JOB_STATUS.RECEIVED && (
                              <button
                                onClick={() => handlePostJob(job.id)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#5C9FD8',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2F6FB3'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5C9FD8'}
                              >
                                Post
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/admin/jobs/${job.id}`)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#0A2239',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e3a5f'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0A2239'}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Job Modal */}
        {showModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}
            onClick={closeModal}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#0A2239',
                borderRadius: '12px 12px 0 0'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                  Create New Job
                </h2>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.5rem' }}>
                {/* Client Information */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Client Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Client Name *
                      </label>
                      <input
                        type="text"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${formErrors.clientName ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Enter client name"
                      />
                      {formErrors.clientName && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {formErrors.clientName}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Email *
                        </label>
                        <input
                          type="email"
                          value={formData.clientEmail}
                          onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.clientEmail ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box'
                          }}
                          placeholder="client@email.com"
                        />
                        {formErrors.clientEmail && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.clientEmail}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Phone *
                        </label>
                        <input
                          type="tel"
                          value={formData.clientPhone}
                          onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.clientPhone ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box'
                          }}
                          placeholder="07123456789"
                        />
                        {formErrors.clientPhone && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.clientPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pickup Details */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Pickup Details
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Pickup Location *
                      </label>
                      <input
                        type="text"
                        value={formData.pickupLocation}
                        onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${formErrors.pickupLocation ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Full address with postcode"
                      />
                      {formErrors.pickupLocation && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {formErrors.pickupLocation}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Pickup Date *
                        </label>
                        <input
                          type="date"
                          value={formData.pickupDate}
                          onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.pickupDate ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box'
                          }}
                        />
                        {formErrors.pickupDate && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.pickupDate}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Pickup Time *
                        </label>
                        <select
                          value={formData.pickupTime}
                          onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.pickupTime ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Select time</option>
                          {generateTimeOptions().map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        {formErrors.pickupTime && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.pickupTime}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Details */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Delivery Details
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Delivery Location *
                      </label>
                      <input
                        type="text"
                        value={formData.deliveryLocation}
                        onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: `1px solid ${formErrors.deliveryLocation ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Full address with postcode"
                      />
                      {formErrors.deliveryLocation && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {formErrors.deliveryLocation}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Delivery Date *
                        </label>
                        <input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.deliveryDate ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box'
                          }}
                        />
                        {formErrors.deliveryDate && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.deliveryDate}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Delivery Time *
                        </label>
                        <select
                          value={formData.deliveryTime}
                          onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.deliveryTime ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Select time</option>
                          {generateTimeOptions().map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        {formErrors.deliveryTime && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.deliveryTime}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cargo Details */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Cargo Details
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Cargo Type *
                        </label>
                        <select
                          value={formData.cargoType}
                          onChange={(e) => setFormData({ ...formData, cargoType: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            boxSizing: 'border-box'
                          }}
                        >
                          {CARGO_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Quantity *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.cargoQuantity}
                          onChange={(e) => setFormData({ ...formData, cargoQuantity: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${formErrors.cargoQuantity ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box'
                          }}
                        />
                        {formErrors.cargoQuantity && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {formErrors.cargoQuantity}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Additional Notes
                      </label>
                      <textarea
                        value={formData.cargoNotes}
                        onChange={(e) => setFormData({ ...formData, cargoNotes: e.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Special handling instructions, fragile items, etc."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0 0 12px 12px'
              }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateJob}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#1F7A3D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}
                >
                  Create Job
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
