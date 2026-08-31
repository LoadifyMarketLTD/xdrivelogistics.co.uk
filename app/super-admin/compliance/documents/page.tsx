'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import OnboardingReviewQueue from './OnboardingReviewQueue';

type DocumentFamily = 'driver' | 'vehicle' | 'company' | 'identity';
type InspectorEntityType = 'driver' | 'vehicle' | 'company' | 'user';

type Row = {
  id: string;
  document_family: DocumentFamily;
  entity_type: 'driver' | 'vehicle' | 'company' | 'identity';
  entity_name: string;
  company_name: string;
  inspector_entity_type: InspectorEntityType | null;
  inspector_entity_id: string | null;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  created_at: string;
  is_expired: boolean;
  file_available: boolean;
};

const openSecureDocument = (url: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default function Page() {
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [pendingReject, setPendingReject] = useState<Row | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const viewDocument = async (row: Row) => {
    if (!row.file_available) {
      setInlineError('This record has no stored file.');
      return;
    }

    setBusyDocumentId(row.id);
    setInlineError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setInlineError('No active Platform Owner session.');
        return;
      }

      const response = await fetch('/api/super-admin/compliance/documents', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentFamily: row.document_family, id: row.id }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        setInlineError(payload.error ?? `Unable to open document (${response.status}).`);
        return;
      }
      openSecureDocument(payload.url);
    } finally {
      setBusyDocumentId(null);
    }
  };

  const updateDocument = async (row: Row, action: 'approve' | 'reject', reason = '') => {
    if (action === 'reject' && reason.trim().length < 5) {
      setPendingReject(row);
      return;
    }
    setBusyDocumentId(row.id);
    setInlineError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setInlineError('No active Platform Owner session.');
        return;
      }

      const response = await fetch('/api/super-admin/compliance/documents', {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentFamily: row.document_family, id: row.id, action, reason: reason || undefined }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setInlineError(payload.error ?? `Update failed (${response.status})`);
      } else {
        setReloadToken(Date.now());
      }
    } finally {
      setBusyDocumentId(null);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'entity',
      label: 'Document owner',
      render: (row: Row) => <div><div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.entity_name}</div><div style={{ fontSize: '0.68rem', color: '#64748B', textTransform: 'capitalize' }}>{row.entity_type}</div></div>,
    },
    { key: 'company', label: 'Company', render: (row: Row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span> },
    { key: 'doc_type', label: 'Document type', render: (row: Row) => <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{row.doc_type.replace(/_/g, ' ')}</span> },
    { key: 'status', label: 'Status', render: (row: Row) => <StatusChip value={row.is_expired ? 'expired' : row.status} /> },
    { key: 'issued_date', label: 'Issued', render: (row: Row) => <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{row.issued_date ?? '—'}</span> },
    { key: 'expiry_date', label: 'Expiry', render: (row: Row) => <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#DC2626' : '#64748B' }}>{row.expiry_date ?? '—'}{row.is_expired ? ' ⚠️' : ''}</span> },
    { key: 'created_at', label: 'Uploaded', render: (row: Row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Review actions',
      render: (row: Row) => {
        const busy = busyDocumentId === row.id;
        return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '104px' }}>
          <button type="button" disabled={busy || !row.file_available} onClick={() => void viewDocument(row)} style={{ fontSize: '0.68rem', fontWeight: 700 }} title={row.file_available ? 'Open a short-lived secure preview' : 'No stored file'}>{busy ? 'Please wait…' : 'View document'}</button>
          <button type="button" disabled={busy} onClick={() => void updateDocument(row, 'approve')} style={{ fontSize: '0.68rem' }}>Approve</button>
          <button type="button" disabled={busy} onClick={() => void updateDocument(row, 'reject')} style={{ fontSize: '0.68rem' }}>Reject</button>
        </div>;
      },
    },
  ], [busyDocumentId]);

  return <>
    <ActionConfirmModal
      open={pendingReject !== null}
      title="Reject document"
      description={<>Reject <strong>{pendingReject?.doc_type.replace(/_/g, ' ')}</strong> for <strong>{pendingReject?.entity_name}</strong>. The canonical compliance review RPC will record the decision and audit provenance.</>}
      confirmLabel="Confirm rejection"
      danger
      reasonRequired
      reasonPlaceholder="Explain why this document is being rejected…"
      submitting={busyDocumentId !== null}
      onCancel={() => setPendingReject(null)}
      onConfirm={(reason) => {
        if (!pendingReject) return;
        const row = pendingReject;
        setPendingReject(null);
        void updateDocument(row, 'reject', reason);
      }}
    />

    {inlineError && <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 999, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '4px solid #DC2626', borderRadius: '4px', padding: '0.75rem 1rem', color: '#B91C1C', fontSize: '0.82rem', maxWidth: '360px', cursor: 'pointer' }} onClick={() => setInlineError(null)} role="alert">{inlineError} <span style={{ opacity: 0.6 }}>(click to dismiss)</span></div>}

    <OnboardingReviewQueue onReviewed={() => setReloadToken(Date.now())} />

    <SuperAdminLiveTablePage<Row>
      icon="📁"
      title="Document Review"
      sectionLabel="Compliance"
      description="All company, identity, driver and vehicle documents. Secure preview and review remain audited; each resolvable row links to the authoritative platform entity."
      endpoint={`/api/super-admin/compliance/documents?limit=250&reload=${reloadToken}`}
      summaryField="summary"
      emptyMessage="No compliance documents found."
      entityLink={(row) => row.inspector_entity_type && row.inspector_entity_id
        ? { entityType: row.inspector_entity_type, entityId: row.inspector_entity_id, label: 'Entity' }
        : null}
      columns={columns}
    />
  </>;
}