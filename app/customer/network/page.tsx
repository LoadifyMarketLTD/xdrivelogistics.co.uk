'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type BidderIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  personName: string | null;
  displayName: string;
};

const money = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
    : 'Not supplied';

export default function CustomerNetworkPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [companySearch, setCompanySearch] = useState('');
  const [relationship, setRelationship] = useState<'all' | 'booked' | 'quoted'>('all');
  const [identities, setIdentities] = useState<Map<string, BidderIdentity>>(new Map());
  const [identityError, setIdentityError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!data.bids.length) { setIdentities(new Map()); setIdentityError(''); return; }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { setIdentityError('Member identities are unavailable until the session is refreshed.'); return; }
      const response = await fetch('/api/workspace/bids/identities', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { identities?: BidderIdentity[]; error?: string };
      if (cancelled) return;
      if (!response.ok) { setIdentityError(payload.error ?? 'Member identities could not be resolved.'); return; }
      setIdentities(new Map((payload.identities ?? []).map((identity) => [identity.bidId, identity])));
      setIdentityError('');
    };
    void load();
    return () => { cancelled = true; };
  }, [data.bids]);

  const carriers = useMemo(() => {
    const map = new Map<string, {
      key: string;
      companyId: string | null;
      driverId: string | null;
      ownerDriver: boolean;
      name: string;
      quotes: number;
      accepted: number;
      latestPrice: number | null;
      jobIds: Set<string>;
    }>();

    for (const bid of data.bids) {
      const identity = identities.get(bid.id);
      const ownerDriver = !bid.company_id && Boolean(identity?.driverId);
      const companyId = bid.company_id ?? (!ownerDriver ? identity?.companyId ?? null : null);
      const driverId = ownerDriver ? identity?.driverId ?? null : null;
      const name = ownerDriver
        ? (identity?.personName || identity?.displayName || 'Owner Driver')
        : (identity?.companyName || bid.companies?.name?.trim() || identity?.displayName || 'Carrier profile incomplete');
      const key = companyId || driverId || bid.company_id || bid.id;
      const row = map.get(key) ?? { key, companyId, driverId, ownerDriver, name, quotes: 0, accepted: 0, latestPrice: null, jobIds: new Set<string>() };
      row.quotes += 1;
      if (bid.status === 'accepted') row.accepted += 1;
      const price = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      if (price > 0 && row.latestPrice == null) row.latestPrice = price;
      row.jobIds.add(bid.job_id);
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => b.accepted - a.accepted || b.quotes - a.quotes || a.name.localeCompare(b.name));
  }, [data.bids, identities]);

  const visibleCarriers = useMemo(() => {
    const needle = companySearch.trim().toLowerCase();
    return carriers.filter((carrier) => {
      if (needle && !`${carrier.name} ${carrier.companyId ?? ''} ${carrier.driverId ?? ''}`.toLowerCase().includes(needle)) return false;
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
        description="Carrier companies and owner-driver members that have quoted for or been booked on your own XDrive transport requests."
        actions={<><ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton><ActionButton tone="primary" onClick={() => router.push('/customer/network/directory')}>Open Directory</ActionButton></>}
      />
      {identityError && <AlertBanner tone="warning">{identityError}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Company relationship filters">
          <div className="workspace-filter-rail__header">Search Companies</div>
          <div className="workspace-filter-rail__body">
            <label>COMPANY / MEMBER<input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Company, owner driver or member ID" /></label>
            <label>RELATIONSHIP<select value={relationship} onChange={(event) => setRelationship(event.target.value as 'all' | 'booked' | 'quoted')}><option value="all">All relationships</option><option value="booked">Booked carriers</option><option value="quoted">Quote activity only</option></select></label>
            <div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>This is your commercial relationship register. It is not the global XDrive Directory.</div>
            <ActionButton tone="secondary" onClick={() => { setCompanySearch(''); setRelationship('all'); }}>Clear</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 4 }}><span><strong>{visibleCarriers.length}</strong> member relationship{visibleCarriers.length === 1 ? '' : 's'}</span><span>{carriers.length} authorised relationship record{carriers.length === 1 ? '' : 's'}</span></div>
          <div className="workspace-panel">
            <DataTable
              columns={['Member', 'Loads quoted', 'Quotes', 'Accepted', 'Latest visible price', 'Relationship', 'Action']}
              rows={visibleCarriers.map((carrier) => [
                <strong key="company"><MemberIdentityLink companyId={carrier.ownerDriver ? null : carrier.companyId} driverId={carrier.ownerDriver ? carrier.driverId : null}>{carrier.name}</MemberIdentityLink></strong>,
                carrier.jobIds.size,
                carrier.quotes,
                carrier.accepted,
                money(carrier.latestPrice),
                <StatusBadge key="relationship" value={carrier.accepted > 0 ? 'booked carrier' : 'quote activity'} tone={carrier.accepted > 0 ? 'green' : 'blue'} />,
                <ActionButton key="action" tone="secondary" onClick={() => router.push('/customer/quotes')}>View quote activity</ActionButton>,
              ])}
              empty={<EmptyState title={data.loading ? 'Loading carrier relationships…' : 'No members in this view'} description={carriers.length === 0 ? 'Carrier companies and owner drivers appear here after they submit quotes on your loads.' : 'Adjust the member or relationship filter.'} />}
            />
          </div>
        </main>
      </div>
    </PageFrame>
  );
}
