'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const money = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
    : 'Not supplied';

export default function CustomerNetworkPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const carriers = useMemo(() => {
    const map = new Map<string, {
      key: string;
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
      const row = map.get(key) ?? { key, name, quotes: 0, accepted: 0, latestPrice: null, jobIds: new Set<string>() };
      row.quotes += 1;
      if (bid.status === 'accepted') row.accepted += 1;
      const price = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      if (price > 0 && row.latestPrice == null) row.latestPrice = price;
      row.jobIds.add(bid.job_id);
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => b.accepted - a.accepted || b.quotes - a.quotes || a.name.localeCompare(b.name));
  }, [data.bids]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer network"
        title="Companies / Network"
        description="Carrier companies that have appeared in quote activity for your own transport requests."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      <Panel
        title="Carrier relationship register"
        description="This is not a global directory. It contains only carrier identities already exposed through your authorised Customer quote data."
      >
        <DataTable
          columns={['Company', 'Loads quoted', 'Quotes', 'Accepted', 'Latest visible price', 'Relationship', 'Action']}
          rows={carriers.map((carrier) => [
            <strong key="company">{carrier.name}</strong>,
            carrier.jobIds.size,
            carrier.quotes,
            carrier.accepted,
            money(carrier.latestPrice),
            <StatusBadge key="relationship" value={carrier.accepted > 0 ? 'booked carrier' : 'quote activity'} tone={carrier.accepted > 0 ? 'green' : 'blue'} />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push('/customer/quotes')}>View quote activity</ActionButton>,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading carrier relationships…' : 'No carrier relationships yet'} description="Carrier companies will appear after they submit quotes on your loads." />}
        />
      </Panel>
    </PageFrame>
  );
}
