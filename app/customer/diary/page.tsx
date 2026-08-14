'use client';

import { useMemo, useState } from 'react';
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

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function CustomerDiaryPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [status, setStatus] = useState('all');

  const rows = useMemo(() => data.jobs
    .filter((job) => status === 'all' || String(job.current_status ?? job.status).toLowerCase() === status)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))), [data.jobs, status]);

  const statuses = useMemo(() => [...new Set(data.jobs
    .map((job) => String(job.current_status ?? job.status).toLowerCase())
    .filter(Boolean))].sort(), [data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer operations"
        title="Diary"
        description="Chronological register of your real transport bookings and their current operational state."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      <Panel
        title="Booking diary"
        description="Open a booking for its route, carrier, commercial, tracking, POD and document details."
        actions={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={{ minHeight: 32, border: '1px solid #D8DEE8', borderRadius: 4, padding: '0 8px', fontSize: 12, background: '#fff' }}
          >
            <option value="all">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
          </select>
        }
      >
        <DataTable
          columns={['Reference', 'Route', 'Pickup', 'Delivery', 'Vehicle', 'Status', 'Last update', 'Action']}
          rows={rows.map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            when(job.updated_at),
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open booking</ActionButton>,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading diary…' : 'No customer bookings recorded'} />}
        />
      </Panel>
    </PageFrame>
  );
}
