'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { DriverDocument, VehicleDocument, DocStatus } from '../../../lib/types/database';

type AnyDoc = (DriverDocument & { kind: 'driver'; subject_name?: string }) | (VehicleDocument & { kind: 'vehicle'; subject_name?: string });

const STATUS_COLORS: Record<DocStatus, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  expired: { bg: '#f3f4f6', text: '#6b7280' },
};
const ALLOWED_DOC_STATUS = new Set<DocStatus>(['pending', 'approved', 'rejected', 'expired']);

export default function DocumentsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'driver' | 'vehicle'>('driver');
  const [error, setError] = useState('');

  const loadDocs = async () => {
    setLoading(true);
    setError('');
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) {
      setDocs([]);
      setError('Company profile not loaded. Document data is hidden until company access resolves.');
      setLoading(false);
      return;
    }
    if (tab === 'driver') {
      const { data, error: driverError } = await supabase
        .from('driver_documents')
        .select('id, driver_id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, verified_by, verified_at, created_at, drivers!inner(display_name, company_id)')
        .eq('drivers.company_id', companyId)
        .order('created_at', { ascending: false });
      if (driverError) {
        setDocs([]);
        setError(`Failed to load driver documents: ${driverError.message}`);
      } else if (data) {
        setDocs(data.map((d: DriverDocument & { drivers?: Array<{ display_name: string }> }) => ({
          ...d,
          kind: 'driver' as const,
          subject_name: Array.isArray(d.drivers) ? d.drivers[0]?.display_name : undefined,
        })));
      }
    } else {
      const { data, error: vehicleError } = await supabase
        .from('vehicle_documents')
        .select('id, vehicle_id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, verified_by, verified_at, created_at, vehicles!inner(reg_plate, company_id)')
        .eq('vehicles.company_id', companyId)
        .order('created_at', { ascending: false });
      if (vehicleError) {
        setDocs([]);
        setError(`Failed to load vehicle documents: ${vehicleError.message}`);
      } else if (data) {
        setDocs(data.map((d: VehicleDocument & { vehicles?: Array<{ reg_plate: string }> }) => ({
          ...d,
          kind: 'vehicle' as const,
          subject_name: Array.isArray(d.vehicles) ? d.vehicles[0]?.reg_plate : undefined,
        })));
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [tab, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, status: DocStatus) => {
    if (!isSupabaseConfigured || !companyId) return;
    if (!ALLOWED_DOC_STATUS.has(status)) {
      setError('Invalid document status update request.');
      return;
    }

    if (tab === 'driver') {
      const { data: verifiedDoc, error: verifyError } = await supabase
        .from('driver_documents')
        .select('id, driver_id, drivers!inner(company_id)')
        .eq('id', id)
        .eq('drivers.company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (verifyError || !verifiedDoc) {
        setError('Driver document not found for the current company.');
        return;
      }

      const { error: updateError } = await supabase
        .from('driver_documents')
        .update({ status })
        .eq('id', id)
        .eq('driver_id', verifiedDoc.driver_id as string);

      if (updateError) {
        console.error('Failed to update document status:', updateError.message);
        setError(`Failed to update document status: ${updateError.message}`);
        return;
      }
    } else {
      const { data: verifiedDoc, error: verifyError } = await supabase
        .from('vehicle_documents')
        .select('id, vehicle_id, vehicles!inner(company_id)')
        .eq('id', id)
        .eq('vehicles.company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (verifyError || !verifiedDoc) {
        setError('Vehicle document not found for the current company.');
        return;
      }

      const { error: updateError } = await supabase
        .from('vehicle_documents')
        .update({ status })
        .eq('id', id)
        .eq('vehicle_id', verifiedDoc.vehicle_id as string);

      if (updateError) {
        console.error('Failed to update document status:', updateError.message);
        setError(`Failed to update document status: ${updateError.message}`);
        return;
      }
    }

    setError('');
    loadDocs();
  };

  const tabStyle = (active: boolean) => ({
    padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600' as const, cursor: 'pointer',
    backgroundColor: active ? '#1F7A3D' : 'white', color: active ? 'white' : '#6b7280',
  });

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Documents</h1>
            <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Review and verify driver & vehicle documents</p>
          </div>

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button style={tabStyle(tab === 'driver')} onClick={() => setTab('driver')}>🪪 Driver Documents</button>
            <button style={tabStyle(tab === 'vehicle')} onClick={() => setTab('vehicle')}>🚛 Vehicle Documents</button>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                <p>No documents found.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {[tab === 'driver' ? 'Driver' : 'Vehicle', 'Doc Type', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d, i) => {
                    const sc = STATUS_COLORS[d.status] ?? STATUS_COLORS.pending;
                    return (
                      <tr key={d.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{d.subject_name || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{d.doc_type}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{d.issued_date || '—'}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{d.expiry_date || '—'}</td>
                        <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{d.status}</span></td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {d.status !== 'approved' && <button onClick={() => updateStatus(d.id, 'approved')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#d1fae5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Approve</button>}
                            {d.status !== 'rejected' && <button onClick={() => updateStatus(d.id, 'rejected')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Reject</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
