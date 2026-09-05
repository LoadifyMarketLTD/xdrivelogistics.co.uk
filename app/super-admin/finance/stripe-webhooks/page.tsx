'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  connected_account: string;
  livemode: boolean | null;
  processing_status: string | null;
  error_message: string | null;
  received_at: string | null;
  processed_at: string | null;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="↻"
    title="Stripe Webhook Operations"
    sectionLabel="Finance"
    description="Delivery and processing state for Stripe webhook events. Secret payloads and account identifiers are not exposed."
    endpoint="/api/super-admin/governance?section=stripe-webhooks"
    pageSize={50}
    emptyMessage="No Stripe webhook events found."
    columns={[
      { key: 'event', label: 'Event', render: (row) => <div><strong>{row.event_type}</strong><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.stripe_event_id}</div></div> },
      { key: 'mode', label: 'Mode', render: (row) => row.livemode ? 'Live' : 'Test' },
      { key: 'account', label: 'Account', render: (row) => row.connected_account },
      { key: 'status', label: 'Processing', render: (row) => <StatusChip value={row.processing_status} /> },
      { key: 'received', label: 'Received', render: (row) => formatDateTime(row.received_at) },
      { key: 'processed', label: 'Processed', render: (row) => formatDateTime(row.processed_at) },
      { key: 'error', label: 'Error', render: (row) => row.error_message?.trim() || '—' },
    ]}
  />;
}
