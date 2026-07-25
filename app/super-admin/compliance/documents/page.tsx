'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type Row = {
  id: string;
  entity_type: 'driver' | 'vehicle';
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  created_at: string;
  is_expired: boolean;
};

export default function Page() {
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);

  const updateDocument = async (row: Row, action: 'approve' | 'reject') => {
    setBusyDocumentId(row.id);
    const auth = await getAuthHeader();
    if (!auth) {
      setBusyDocumentId(null);
      return;
    }

    const reason =
      action === 'reject'
        ? window.prompt('Reason for rejection:', '') ?? ''
        : '';

    const response = await fetch('/api/super-admin/compliance', {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section: 'documents',
        entityType: row.entity_type,
        id: row.id,
        action,
        reason: reason.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      window.alert(payload.error ?? `Update failed (${response.status})`);
    } else {
      setReloadToken(Date.now());
    }
    setBusyDocumentId(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'entity',
        label: 'Owner',
        render: (row: Row) => (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.entity_name}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{row.entity_type}</div>
          </div>
        ),
      },
      {
        key: 'company',
        label: 'Company',
        render: (row: Row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
      },
      {
        key: 'doc_type',
        label: 'Document Type',
        render: (row: Row) => <span style={{ fontSize: '0.78rem' }}>{row.doc_type}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: Row) => <StatusChip value={row.status} />,
      },
      {
        key: 'expiry_date',
        label: 'Expiry',
        render: (row: Row) => (
          <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#ef4444' : '#f1f5f9' }}>
            {row.expiry_date ?? '—'}
            {row.is_expired ? ' ⚠️' : ''}
          </span>
        ),
      },
      {
        key: 'created_at',
        label: 'Uploaded',
        render: (row: Row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row: Row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '92px' }}>
            <button type="button" disabled={busyDocumentId === row.id} onClick={() => void updateDocument(row, 'approve')} style={{ fontSize: '0.68rem' }}>
              Approve
            </button>
            <button type="button" disabled={busyDocumentId === row.id} onClick={() => void updateDocument(row, 'reject')} style={{ fontSize: '0.68rem' }}>
              Reject
            </button>
          </div>
        ),
      },
    ],
    [busyDocumentId]
  );

  return (
    <SuperAdminLiveTablePage<Row>
      icon="📁"
      title="Document Review"
      sectionLabel="Compliance"
      description="All driver and vehicle documents across the platform — review and approval pipeline."
      endpoint={`/api/super-admin/compliance?section=documents&limit=250&reload=${reloadToken}`}
      summaryField="summary"
      emptyMessage="No documents found."
      columns={columns}
    />
  );
}
