'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  job_id: string;
  status: string;
  description: string;
  raised_by: string;
  job_status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="⚠️"
      title="Disputes"
      sectionLabel="Operations"
      description="Open and in-progress job disputes requiring resolution."
      endpoint="/api/super-admin/operations?section=disputes&limit=250"
      emptyMessage="No disputes found."
      entityLink={(row) => ({ entityType: 'dispute', entityId: row.id, label: 'Inspect dispute' })}
      columns={[
        {
          key: 'dispute_status',
          label: 'Dispute Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'route',
          label: 'Job Route',
          render: (row) => routeSummary(row.pickup_location, null, row.delivery_location, null),
        },
        {
          key: 'job_status',
          label: 'Job Status',
          render: (row) => <StatusChip value={row.job_status} />,
        },
        {
          key: 'raised_by',
          label: 'Raised By',
          render: (row) => row.raised_by,
        },
        {
          key: 'description',
          label: 'Description',
          render: (row) => row.description,
        },
        {
          key: 'created',
          label: 'Raised',
          render: (row) => formatDateTime(row.created_at),
        },
      ]}
    />
  );
}
