'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { JOB_STATUS, JOB_STATUS_LABEL } from '../../config/company';
import { supabase } from '../../../lib/supabaseClient';
import { buildLegacyJobSpecialRequirements, getJobClientFields } from '../../../lib/jobClientFields';
import { useAuth } from '../../components/AuthContext';

interface Job {
  id: string;
  jobRef: string;
  assignedDriverId: string | null;
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
  distanceMiles: number | null;
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

interface DriverOption {
  id: string;
  display_name: string | null;
  full_name?: string | null;
  email: string | null;
}

const getDriverLabel = (driver: DriverOption) => {
  const name = driver.display_name || driver.full_name || 'Unnamed driver';
  return driver.email ? `${name} (${driver.email})` : name;
};

const CARGO_TYPES = [
  'Documents',
  'Packages',
  'Pallets',
  'Furniture',
  'Equipment',
  'Other',
];

const STATUS_OPTIONS = Object.values(JOB_STATUS);

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;
  const { user, hasSupabaseSession } = useAuth();
  const companyId = user?.companyId ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Job | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [exchangeVisibility, setExchangeVisibility] = useState<'private' | 'exchange' | null>(null);
  const [publishingExchange, setPublishingExchange] = useState(false);

  useEffect(() => {
    loadJob();
    if (companyId) loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, hasSupabaseSession, companyId]);

  const loadDrivers = async () => {
    if (!companyId) {
      setDrivers([]);
      return;
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('id, display_name, full_name, email')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('display_name', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Failed to load active company drivers:', error.message);
      setDrivers([]);
      return;
    }

    setDrivers((data ?? []) as DriverOption[]);
  };

  const loadJob = async () => {
    try {
      if (hasSupabaseSession) {
        if (!companyId) {
          setJob(null);
          setFormData(null);
          setSaveMessage('Company profile not loaded. This job cannot be accessed safely.');
          return;
        }

        const { data, error } = await supabase
          .from('jobs')
          .select('id, company_id, status, cargo_type, pickup_location, pickup_datetime, delivery_location, delivery_datetime, items, client_name, client_email, client_phone, load_details, special_requirements, assigned_driver_id, distance_miles, created_at, updated_at, status_history, collection_photo_url, delivery_photos, delivery_signature_data, client_signature_name, exchange_visibility, exchange_posted_at')
          .eq('id', jobId)
          .eq('company_id', companyId)
          .single();
        if (error) {
          console.error('Failed to load job:', error.message);
          setSaveMessage('Job not found');
          return;
        }
        if (data) {
          const row = data as Record<string, unknown>;
          const clientFields = getJobClientFields(row);
          const mapped: Job = {
            id: row.id as string,
            jobRef: (row.id as string).slice(0, 13).toUpperCase(),
            assignedDriverId: (row.assigned_driver_id as string | null) ?? null,
            client: {
              name: clientFields.name,
              email: clientFields.email,
              phone: clientFields.phone,
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
              type: (row.cargo_type as string) || 'other',
              quantity: (row.items as number) || 1,
              notes: clientFields.cargoNotes,
            },
            distanceMiles:
              typeof row.distance_miles === 'number'
                ? row.distance_miles
                : row.distance_miles !== null && row.distance_miles !== undefined
                  ? Number(row.distance_miles)
                  : null,
            status: (row.status as string) || JOB_STATUS.RECEIVED,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
            statusHistory: Array.isArray(row.status_history)
              ? (row.status_history as Array<{ status: string; timestamp: string }>)
              : undefined,
            pod: (() => {
              const pickupPhotos = typeof row.collection_photo_url === 'string' && row.collection_photo_url.length > 0
                ? [row.collection_photo_url]
                : [];
              const deliveryPhotos = Array.isArray(row.delivery_photos)
                ? (row.delivery_photos as string[]).filter((photo) => typeof photo === 'string' && photo.length > 0)
                : [];
              const signature = typeof row.delivery_signature_data === 'string' && row.delivery_signature_data.length > 0
                ? row.delivery_signature_data
                : undefined;
              const recipientName = typeof row.client_signature_name === 'string' && row.client_signature_name.length > 0
                ? row.client_signature_name
                : undefined;
              const historyTimestamp = Array.isArray(row.status_history) && row.status_history.length > 0
                ? (row.status_history[row.status_history.length - 1] as { timestamp?: string }).timestamp
                : undefined;

              if (!pickupPhotos.length && !deliveryPhotos.length && !signature && !recipientName && !historyTimestamp) {
                return undefined;
              }

              return {
                pickupPhotos,
                deliveryPhotos,
                signature,
                recipientName,
                timestamp: historyTimestamp ?? (row.updated_at as string | undefined),
              };
            })(),
          };
          setJob(mapped);
          setFormData(mapped);
          setExchangeVisibility((row.exchange_visibility as 'private' | 'exchange' | null) ?? 'private');
          return;
        }
      }
      setSaveMessage('A live Supabase session is required to access job details safely.');
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

  const handlePublishToExchange = async () => {
    if (!companyId || !jobId) return;
    const isPublished = exchangeVisibility === 'exchange';
    const newVisibility = isPublished ? 'private' : 'exchange';
    setPublishingExchange(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          exchange_visibility: newVisibility,
          exchange_posted_at: newVisibility === 'exchange' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('company_id', companyId);
      if (error) {
        setSaveMessage(`Failed to update exchange visibility: ${error.message}`);
      } else {
        setExchangeVisibility(newVisibility);
        setSaveMessage(newVisibility === 'exchange' ? '✅ Load published to Exchange Marketplace!' : '✅ Load removed from Exchange Marketplace.');
      }
    } catch (err) {
      setSaveMessage('Error updating exchange visibility.');
      console.error(err);
    } finally {
      setPublishingExchange(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    try {
      if (hasSupabaseSession) {
        if (!companyId) {
          setSaveMessage('Company profile not loaded. Job cannot be updated safely.');
          setTimeout(() => setSaveMessage(''), 3000);
          return;
        }

        const { error } = await supabase.from('jobs').update({
          client_name: formData.client.name,
          client_email: formData.client.email || null,
          client_phone: formData.client.phone || null,
          special_requirements: buildLegacyJobSpecialRequirements({
            clientPhone: formData.client.phone,
            clientEmail: formData.client.email,
            cargoNotes: formData.cargo.notes,
          }),
          pickup_location: formData.pickup.location,
          pickup_datetime: formData.pickup.date && formData.pickup.time ? `${formData.pickup.date}T${formData.pickup.time}:00` : null,
          delivery_location: formData.delivery.location,
          delivery_datetime: formData.delivery.date && formData.delivery.time ? `${formData.delivery.date}T${formData.delivery.time}:00` : null,
          cargo_type: formData.cargo.type.toLowerCase(),
          items: formData.cargo.quantity,
          distance_miles: formData.distanceMiles,
          status: formData.status,
          assigned_driver_id: formData.assignedDriverId || null,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId).eq('company_id', companyId);
        if (error) {
          console.error('Failed to save job:', error.message);
          setSaveMessage('Error saving job. Please try again.');
          setTimeout(() => setSaveMessage(''), 3000);
          return;
        }
        const updatedJob = { ...formData, updatedAt: new Date().toISOString() };
        setJob(updatedJob);
        setFormData(updatedJob);
        setEditMode(false);
        setSaveMessage('Job saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
        return;
      }
      setSaveMessage('A live Supabase session is required to save job changes safely.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving job:', error);
      setSaveMessage('Error saving job. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleDelete = async () => {
    try {
      if (hasSupabaseSession) {
        if (!companyId) {
          setSaveMessage('Company profile not loaded. Job cannot be deleted safely.');
          setTimeout(() => setSaveMessage(''), 3000);
          return;
        }

        const { error } = await supabase
          .from('jobs')
          .delete()
          .eq('id', jobId)
          .eq('company_id', companyId);
        if (error) {
          console.error('Failed to delete job:', error.message);
          setSaveMessage('Error deleting job. Please try again.');
          setTimeout(() => setSaveMessage(''), 3000);
          return;
        }
        router.push('/admin/jobs');
        return;
      }
      setSaveMessage('A live Supabase session is required to delete jobs safely.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting job:', error);
      setSaveMessage('Error deleting job. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleGenerateInvoice = () => {
    if (!job) return;

    const params = new URLSearchParams({
      jobRef: job.jobRef,
      clientName: job.client.name,
      clientEmail: job.client.email,
      pickupLocation: job.pickup.location,
      pickupDateTime: `${job.pickup.date}T${job.pickup.time}`,
      deliveryLocation: job.delivery.location,
      deliveryDateTime: `${job.delivery.date}T${job.delivery.time}`,
      serviceDescription: `${job.cargo.type} delivery - ${job.cargo.quantity} unit(s)`,
    });

    router.push(`/admin/invoices/new?${params.toString()}`);
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
      {/* ...restul componentei... */}
    </ProtectedRoute>
  );
}
