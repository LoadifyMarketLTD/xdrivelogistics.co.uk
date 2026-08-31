'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import OnboardingReviewQueue from './OnboardingReviewQueue';

type DocumentFamily = 'driver' | 'vehicle' | 'company' | 'identity';

type Row = {
  id: string;
  document_family: DocumentFamily;
  entity_type: 'driver' | 'vehicle' | 'company' | 'identity';
  entity_name: string;
  company_name: string;
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
  // PR-0.5: modal for rejection (requires reason)
  const [pendingReject, setPendingReject] = useState<Row | null>(null);
  // PR-0.5: inline error replacing window.alert
  const [inlineError, setInlineError] = useState<string | null>(null);

  const viewDocument = async (row: Row) => {
    if (!row.file_available) {
      setInlineError('This record has no stored file.');
      return;
    }

    setBusyDocumentId(row.id);
    try {
      const auth = await getAuthHeader();
      if (!auth) return;

      const response = await fetch('/api/super-admin/compliance/documents', {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentFamily: row.document_family,
          id: row.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };

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
    if (action === 'reject' && !reason) {
      setPendingReject(row);
      return;
    }
    setBusyDocumentId(row.id);
    try {
      const auth = await getAuthHeader();
      if (!auth) return;

      const response = await fetch('/api/super-admin/compliance/documents', {
        method: 'PATCH',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentFamily: row.document_family,
          id: row.id,
          action,
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setInlineError(payload.error ?? `Update failed (${response.status})`);
      } else {
        setReloadToken(Date.now());
      }
    } finally {
      setBusyDocumentId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'entity',
        label: 'Document owner',
        render: (row: Row) => (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.entity_name}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'capitalize' }}>
              {row.entity_type}
            </div>
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
        label: 'Document type',
        render: (row: Row) => (
          <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>
            {row.doc_type.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: Row) => <StatusChip value={row.is_expired ? 'expired' : row.status} />,
      },
      {
        key: 'issued_date',
        label: 'Issued',
        render: (row: Row) => (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {row.issued_date ?? '—'}
          </span>
        ),
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
        render: (row: Row) => {
          const busy = busyDocumentId === row.id;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '104px' }}>
              <button
                type="button"
                disabled={busy || !row.file_available}
                onClick={() => void viewDocument(row)}
                style={{ fontSize: '0.68rem', fontWeight: 700 }}
                title={row.file_available ? 'Open a short-lived secure preview' : 'No stored file'}
              >
                {busy ? 'Please wait…' : 'View document'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void updateDocument(row, 'approve')}
                style={{ fontSize: '0.68rem' }}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void updateDocument(row, 'reject')}
                style={{ fontSize: '0.68rem' }}
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ],
    [busyDocumentId],
  );

  return (
    <>
      {/* PR-0.5: rejection confirmation modal */}
      <ActionConfirmModal
        open={pendingReject !== null}
        title="❌ Reject document"
        description={
          <>Reject <strong style={{ color: '#f1f5f9' }}>{pendingReject?.doc_type.replace(/_/g, ' ')}</strong> for <strong style={{ color: '#f1f5f9' }}>{pendingReject?.entity_name}</strong>. The document will be marked as rejected.</>
        }
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
      {/* PR-0.5: inline error banner replacing window.alert */}
      {inlineError && (
        <div
          style={{
            position: 'fixed', top: '1rem', right: '1rem', zIndex: 999,
            backgroundColor: '#7f1d1d', border: '1px solid #ef4444',
            borderRadius: '8px', padding: '0.75rem 1rem',
            color: '#fca5a5', fontSize: '0.82rem', maxWidth: '360px',
            cursor: 'pointer',
          }}
          onClick={() => setInlineError(null)}
          role="alert"
        >
          ⚠️ {inlineError} <span style={{ opacity: 0.6 }}>(click to dismiss)</span>
        </div>
      )}
      <OnboardingReviewQueue onReviewed={() => setReloadToken(Date.now())} />
      <SuperAdminLiveTablePage<Row>
        icon="📁"
        title="Document Review"
        sectionLabel="Compliance"
        description="All company, identity, driver and vehicle documents across the platform. Secure previews are issued only to the Platform Owner and every view or review action is audit logged."
        endpoint={`/api/super-admin/compliance/documents?limit=250&reload=${reloadToken}`}
        summaryField="summary"
        emptyMessage="No compliance documents found."
        columns={columns}
      />
    </>
  );
}
