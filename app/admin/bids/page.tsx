'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { JobBid } from '../../../lib/types/database';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function BidsPage() {
  const router = useRouter();
  const [bids, setBids] = useState<JobBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBids(); }, []);

  const loadBids = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase.from('job_bids').select('*').order('created_at', { ascending: false });
    if (!error && data) setBids(data as JobBid[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('job_bids').update({ status }).eq('id', id);
    loadBids();
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Job Bids</h1>
              <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Review and manage incoming job bids</p>
            </div>
            <button onClick={() => router.push('/admin')} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#0A2239', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
              ← Back to Admin
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : bids.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
                <p>No bids yet.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Job ID', 'Amount', 'Currency', 'Message', 'Status', 'Submitted', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b, i) => {
                    const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.submitted;
                    return (
                      <tr key={b.id} style={{ borderBottom: i < bids.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '1rem', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.job_id.slice(0, 8)}…</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#1f2937' }}>£{b.amount.toFixed(2)}</td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{b.currency}</td>
                        <td style={{ padding: '1rem', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message || '—'}</td>
                        <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{b.status}</span></td>
                        <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {b.status === 'submitted' && (
                              <>
                                <button onClick={() => updateStatus(b.id, 'accepted')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#d1fae5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Accept</button>
                                <button onClick={() => updateStatus(b.id, 'rejected')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Reject</button>
                              </>
                            )}
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
