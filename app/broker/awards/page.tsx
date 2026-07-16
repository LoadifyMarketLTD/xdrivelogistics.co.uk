'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import BrokerWorkspaceTabs from '../_components/BrokerWorkspaceTabs';

type AwardedJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  status: string;
  awarded_carrier_company_id: string | null;
  created_at: string;
  companies: { name: string } | null;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  awarded:    { bg: '#F4F6F8', text: '#1D57D8' },
  allocated:  { bg: '#F4F6F8', text: '#1D57D8' },
  collected:  { bg: '#F4F6F8', text: '#F5A300' },
  in_transit: { bg: '#F4F6F8', text: '#1D57D8' },
  delivered:  { bg: '#F4F6F8', text: '#1D57D8' },
  invoiced:   { bg: '#F4F6F8', text: '#1D57D8' },
  paid:       { bg: '#F4F6F8', text: '#1D57D8' },
};

export default function BrokerAwardsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AwardedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const resolve = async () => {
      const id = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      setCompanyId(id ?? null);
    };
    void resolve();
  }, [user?.id, user?.companyId]);

  const loadAwards = useCallback(async () => {
    if (!companyId || !isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    // Jobs where this company is the awarded carrier
    const { data, error: err } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, cargo_type, status, awarded_carrier_company_id, created_at, companies!jobs_company_id_fkey(name)')
      .eq('awarded_carrier_company_id', companyId)
      .in('status', ['awarded','allocated','collected','in_transit','delivered','invoiced','paid'])
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setJobs((data ?? []) as unknown as AwardedJob[]);
  }, [companyId]);

  useEffect(() => { void loadAwards(); }, [loadAwards]);

  const active   = jobs.filter(j => ['awarded','allocated','collected','in_transit'].includes(j.status));
  const complete = jobs.filter(j => ['delivered','invoiced','paid'].includes(j.status));

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', background: '#F4F6F8' }}>
        <BrokerWorkspaceTabs />

        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.25rem' }}>
          <h1 style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1.5rem', color: '#1A1F2B' }}>Awarded Contracts</h1>
          <p style={{ margin: '0 0 1.25rem', color: '#0B2F6B', fontSize: '0.85rem' }}>Jobs where your company has been selected as the carrier.</p>

          {error && <div style={{ background: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: '#1A1F2B' }}>{error}</div>}

          {loading ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', textAlign: 'center', color: '#0B2F6B' }}>Loading awards…</div>
          ) : jobs.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', textAlign: 'center', color: '#0B2F6B' }}>
              No awarded contracts yet. <button onClick={() => router.push('/broker/loads')} style={{ color: '#1D57D8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Browse the Load Board</button>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1D57D8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>🚚 In Progress ({active.length})</h2>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {active.map(job => {
                      const color = STATUS_COLORS[job.status] ?? { bg: '#F4F6F8', text: '#0B2F6B' };
                      return (
                        <div key={job.id} style={{ background: '#FFFFFF', borderRadius: '12px', border: `1px solid #F4F6F8`, padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#1A1F2B' }}>{job.pickup_location || '—'} → {job.delivery_location || '—'}</div>
                              <div style={{ fontSize: '0.8rem', color: '#0B2F6B', marginTop: '0.2rem' }}>
                                Shipper: <strong>{(job.companies as { name: string } | null)?.name ?? 'Unknown'}</strong>
                              </div>
                            </div>
                            <span style={{ background: color.bg, color: color.text, padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{job.status.replace(/_/g,' ')}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                            {job.vehicle_type && <span style={{ background: '#F4F6F8', color: '#0B2F6B', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{job.vehicle_type.replace(/_/g,' ')}</span>}
                            {job.cargo_type   && <span style={{ background: '#F4F6F8', color: '#1A1F2B', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{job.cargo_type}</span>}
                          </div>
                          {job.pickup_datetime && <div style={{ fontSize: '0.77rem', color: '#0B2F6B', marginTop: '0.4rem' }}>Pickup: {new Date(job.pickup_datetime).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {complete.length > 0 && (
                <div>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1D57D8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>✅ Completed ({complete.length})</h2>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {complete.map(job => {
                      const color = STATUS_COLORS[job.status] ?? { bg: '#F4F6F8', text: '#0B2F6B' };
                      return (
                        <div key={job.id} style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '0.9rem', opacity: 0.85 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 600, color: '#1A1F2B', fontSize: '0.92rem' }}>{job.pickup_location || '—'} → {job.delivery_location || '—'}</div>
                            <span style={{ background: color.bg, color: color.text, padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>{job.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
