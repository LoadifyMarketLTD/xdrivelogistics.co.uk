'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  workspaceTheme,
} from '../../components/workspace/WorkspaceUI';

type PublicEnquiry = {
  id: string;
  company_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

const when = (value: string) => new Date(value).toLocaleString('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const money = (amount: number | null, currency: string | null) =>
  typeof amount === 'number'
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
    : 'Not priced';

const normaliseStatus = (value: string | null) => (value || 'draft').replaceAll('_', ' ');

export default function BrokerPublicEnquiries() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PublicEnquiry[]>([]);
  const [selected, setSelected] = useState<PublicEnquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured for this workspace.');
      setLoading(false);
      return;
    }
    if (!user?.companyId) {
      setError('No active broker company is available for this account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('quotes')
      .select('id,company_id,customer_name,customer_email,customer_phone,pickup_location,delivery_location,vehicle_type,cargo_type,amount,currency,status,notes,created_at')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .limit(250);

    if (queryError) {
      setRows([]);
      setError(queryError.message || 'Unable to load public enquiries.');
    } else {
      setRows((data ?? []) as PublicEnquiry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId]);

  const metrics = useMemo(() => {
    const newCount = rows.filter((row) => ['draft', 'new'].includes(String(row.status || '').toLowerCase())).length;
    const priced = rows.filter((row) => typeof row.amount === 'number' && row.amount > 0).length;
    const today = new Date().toDateString();
    const todayCount = rows.filter((row) => new Date(row.created_at).toDateString() === today).length;
    return { total: rows.length, newCount, priced, todayCount };
  }, [rows]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer intake"
        title="Public Enquiries"
        description="Transport enquiries submitted through app.xdrivelogistics.co.uk. Review the customer, route and load details here before pricing or converting the work into an operational job."
        actions={<ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="All enquiries" value={loading ? '—' : metrics.total} detail="Current company" tone="blue" />
        <KpiCard label="New / draft" value={loading ? '—' : metrics.newCount} detail="Needs review" tone="orange" />
        <KpiCard label="Received today" value={loading ? '—' : metrics.todayCount} detail="New intake" tone="navy" />
        <KpiCard label="Priced" value={loading ? '—' : metrics.priced} detail="Amount recorded" tone="green" />
      </KpiGrid>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0, 1.55fr) minmax(340px, .85fr)' : '1fr', gap: 12, marginTop: 12 }}>
        <Panel title="Enquiry queue" description="Select an enquiry to inspect every captured detail.">
          {loading ? (
            <div style={{ padding: 20, color: workspaceTheme.muted, fontSize: 12 }}>Loading enquiries…</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No public enquiries" description="New requests submitted through the commercial site will appear here." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: workspaceTheme.surfaceSoft, color: workspaceTheme.muted, textAlign: 'left' }}>
                    {['Customer', 'Route', 'Cargo / vehicle', 'Price', 'Status', 'Received', ''].map((label) => (
                      <th key={label} style={{ padding: '8px 10px', borderBottom: `1px solid ${workspaceTheme.border}`, fontWeight: 700 }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${workspaceTheme.divider}`, background: selected?.id === row.id ? '#eef4ff' : '#fff' }}>
                      <td style={{ padding: '9px 10px' }}>
                        <strong style={{ display: 'block', color: workspaceTheme.text }}>{row.customer_name || 'Customer'}</strong>
                        <span style={{ color: workspaceTheme.muted }}>{row.customer_email || 'No email'}</span>
                      </td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}><strong>{row.pickup_location || '—'} → {row.delivery_location || '—'}</strong></td>
                      <td style={{ padding: '9px 10px' }}>{row.cargo_type || '—'}{row.vehicle_type ? ` · ${row.vehicle_type}` : ''}</td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{money(row.amount, row.currency)}</td>
                      <td style={{ padding: '9px 10px' }}><StatusBadge value={normaliseStatus(row.status)} /></td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{when(row.created_at)}</td>
                      <td style={{ padding: '9px 10px' }}><ActionButton tone="secondary" onClick={() => setSelected(row)}>Open</ActionButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && (
          <Panel
            title="Enquiry details"
            description={`Received ${when(selected.created_at)}`}
            actions={<ActionButton tone="secondary" onClick={() => setSelected(null)}>Close</ActionButton>}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <Detail label="Customer" value={selected.customer_name || '—'} />
              <Detail label="Email" value={selected.customer_email || '—'} />
              <Detail label="Phone" value={selected.customer_phone || '—'} />
              <Detail label="Route" value={`${selected.pickup_location || '—'} → ${selected.delivery_location || '—'}`} />
              <Detail label="Cargo" value={selected.cargo_type || '—'} />
              <Detail label="Vehicle" value={selected.vehicle_type || 'Not specified'} />
              <Detail label="Current price" value={money(selected.amount, selected.currency)} />
              <Detail label="Status" value={normaliseStatus(selected.status)} />
              <Detail label="Request notes" value={selected.notes || 'No notes supplied'} multiline />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {selected.customer_phone && (
                  <ActionButton tone="primary" onClick={() => { window.location.href = `tel:${selected.customer_phone}`; }}>Call customer</ActionButton>
                )}
                {selected.customer_email && (
                  <ActionButton tone="secondary" onClick={() => { window.location.href = `mailto:${selected.customer_email}`; }}>Email customer</ActionButton>
                )}
              </div>

              <div style={{ marginTop: 4, padding: 10, background: '#fff8e6', border: '1px solid #f5d98b', borderRadius: 4, color: '#6b4d00', fontSize: 11, lineHeight: '16px' }}>
                Pricing, status progression and Convert to Job will be enabled through the broker server API so public enquiries remain company-scoped and auditable.
              </div>
            </div>
          </Panel>
        )}
      </div>
    </PageFrame>
  );
}

function Detail({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ borderBottom: `1px solid ${workspaceTheme.divider}`, paddingBottom: 9 }}>
      <div style={{ color: workspaceTheme.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ color: workspaceTheme.text, fontSize: 12, lineHeight: multiline ? '18px' : '16px', whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{value}</div>
    </div>
  );
}
