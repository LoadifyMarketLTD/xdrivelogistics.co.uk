...'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { JOB_STATUS, JOB_STATUS_LABEL } from '../../../config/company';
import { supabase } from '../../../../lib/supabaseClient';
import { buildLegacyJobSpecialRequirements, getJobClientFields } from '../../../../lib/jobClientFields';
import { useAuth } from '../../../components/AuthContext';

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
  user_id: string;
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
  'Other'
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

  // ... rest of the original component code ...

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* ... */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
          <label style={labelStyle}>🚗 Assigned Driver</label>
          {editMode ? (
            <select
              value={formData.assignedDriverId ?? ''}
              onChange={(e) => setFormData({ ...formData, assignedDriverId: e.target.value || null })}
              style={{ ...inputStyle, maxWidth: '320px' }}
            >
              <option value="">— Unassigned —</option>
              {drivers.length === 0 && (
                <option value="" disabled>
                  No active drivers found for this company
                </option>
              )}
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {getDriverLabel(d)}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: '0.95rem', color: formData.assignedDriverId ? '#1f2937' : '#9ca3af' }}>
              {formData.assignedDriverId
                ? (() => {
                    const assignedDriver = drivers.find((d) => d.id === formData.assignedDriverId);
                    return assignedDriver ? getDriverLabel(assignedDriver) : 'Assigned driver not found in this company';
                  })()
                : 'No driver assigned'}
            </div>
          )}
        </div>
        {/* ... */}
      </div>
    </ProtectedRoute>
  );
}
