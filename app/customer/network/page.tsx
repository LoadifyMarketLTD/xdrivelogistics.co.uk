'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const money = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
    : 'Not supplied';

export default function CustomerNetworkPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [companySearch, setCompanySearch] = useState('');
  const [relationship, setRelationship] = useState<'all' | 'booked' | 'quoted'>('all');

  const carriers = useMemo(() => {
    const map = new Map<string, {
      key: string;
      companyId: string | null;
      name: string;
      quotes: number;
      accepted: number;
      latestPrice: number | null;
      jobIds: Set<string>;
    }>();

    for (const bid of data.bids) {
      const name = bid.companies?.name?.trim();
      if (!name) continue;
      const key = bid.company_id || name.toLowerCase();
      const row = map.get(key) ?? { key, companyId: bid.company_id ?? null, name, quotes: 0, accepted: 0, latestPrice: null, jobIds: new Set<string>() };
      row.quotes += 1;
      if (bid.status === 'accepted') row.accepted += 1;
      const price = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      if (price > 0 && row.latestPrice == null) row.latestPrice = price;
      row.jobIds.add(bid.job_id);
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => b.accepted - a.accepted || b.quotes - a.quotes || a.name.localeCompare(b.name));
  }, [data.bids]);

  const visibleCarriers = useMemo(() => {
    const needle = companySearch.trim().toLowerCase();
    return carriers.filter((carrier) => {
      if (needle && !carrier.name.toLowerCase().includes(needle) && !carrier.companyId?.toLowerCase().includes(needle)) return false;
      if (relationship === 'booked' && carrier.accepted === 0) return false;
      if (relationship === 'quoted' && carrier.accepted > 0) return false;
      return true;
    });
  }, [carriers, companySearch, relationship]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer relationships"
        title="Companies"
        description="Carrier companies that have quoted for or been booked on your own XDrive transport requests."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Company relationship filters">
          <div className="workspace-filter-rail__header">Search Companies</div>
          <div className="workspace-filter-rail__body">
            <label>COMPANY / MEMBER<input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Company name or ID" /></label>
            <label>RELATIONSHIP<select value={relationship} onChange={(event) => setRelationship(event.target.value as 'all' | 'booked' | 'quoted')}><option value="all">All relationships</option><option value="booked">Booked carriers</option><option value="quoted">Quote activity only</option></select></label>
            <div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>This is your commercial relationship register. It is not the global XDrive Directory.</div>
            <ActionButton tone="secondary" onClick={() => { setCompanySearch(''); setRelationship('all'); }}>Clear</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 4 }}><span><strong>{visibleCarriers.length}</strong> compan{visibleCarriers.length === 1 ? 'y' : 'ies'}</span><span>{carriers.length} authorised relationship record{carriers.length === 1 ? '' : 's'}</span></div>
          <div className="workspace-panel">
            <DataTable
              columns={['Company', 'Loads quoted', 'Quotes', 'Accepted', 'Latest visible price', 'Relationship', 'Action']}
              rows={visibleCarriers.map((carrier) => [
                <strong key="company">{carrier.companyId ? <MemberIdentityLink companyId={carrier.companyId}>{carrier.name}</MemberIdentityLink> : carrier.name}</strong>,
                carrier.jobIds.size,
                carrier.quotes,
                carrier.accepted,
                money(carrier.latestPrice),
                <StatusBadge key="relationship" value={carrier.accepted > 0 ? 'booked carrier' : 'quote activity'} tone={carrier.accepted > 0 ? 'green' : 'blue'} />,
                <ActionButton key="action" tone="secondary" onClick={() => router.push('/customer/quotes')}>View quote activity</ActionButton>,
              ])}
              empty={<EmptyState title={data.loading ? 'Loading carrier relationships…' : 'No companies in this view'} description={carriers.length === 0 ? 'Carrier companies appear here after they submit quotes on your loads.' : 'Adjust the company or relationship filter.'} />}
            />
          </div>
        </main>
      </div>
    </PageFrame>
  );
}
