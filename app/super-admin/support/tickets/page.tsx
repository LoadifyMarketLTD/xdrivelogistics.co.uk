'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';

type Row = {
  id: string;
  company_name: string;
  subject: string | null;
  description: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  created_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
};

export default function Page() {
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [pendingModal, setPendingModal] = useState<{ ticket: Row; action: 'investigating' | 'resolve' | 'close' | 'reopen' } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const runAction = async (ticket: Row, action: 'investigating' | 'resolve' | 'close' | 'reopen', reason: string) => {
    setBusyTicketId(ticket.id);
    const auth = await getAuthHeader();
    if (!auth) {
      setBusyTicketId(null);
      return;
    }

    const response = await fetch('/api/super-admin/support', {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section: 'tickets',
        ticketId: ticket.id,
        action,
        note: reason,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setInlineError(payload.error ?? `Action failed (${response.status})`);
    } else {
      setReloadToken(Date.now());
    }
    setBusyTicketId(null);
  };

  const initiateAction = (ticket: Row, action: 'investigating' | 'resolve' | 'close' | 'reopen') => {
    setPendingModal({ ticket, action });
  };

  const columns = useMemo(
    () => [
      {
        key: 'company',
        label: 'Company',
        render: (row: Row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name ?? 'Unknown'}</span>,
      },
      {
        key: 'subject',
        label: 'Subject',
        render: (row: Row) => <span style={{ fontSize: '0.75rem' }}>{row.subject ?? '—'}</span>,
      },
      {
        key: 'category',
        label: 'Category',
        render: (row: Row) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{row.category ?? '—'}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: Row) => <StatusChip value={row.status} />,
      },
      {
        key: 'priority',
        label: 'Priority',
        render: (row: Row) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{row.priority ?? '—'}</span>,
      },
      {
        key: 'created_at',
        label: 'Created',
        render: (row: Row) => (
          <span style={{ fontSize: '0.75rem' }}>
            {row.created_at ? formatDateTime(row.created_at) : '—'}
          </span>
        ),
      },
      {
        key: 'resolved_at',
        label: 'Resolved',
        render: (row: Row) => (
          <span style={{ fontSize: '0.75rem' }}>
            {row.resolved_at ? formatDateTime(row.resolved_at) : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row: Row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => initiateAction(row, 'investigating')} style={{ fontSize: '0.68rem' }}>Investigate</button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => initiateAction(row, 'resolve')} style={{ fontSize: '0.68rem' }}>Resolve</button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => initiateAction(row, 'close')} style={{ fontSize: '0.68rem' }}>Close</button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => initiateAction(row, 'reopen')} style={{ fontSize: '0.68rem' }}>Reopen</button>
          </div>
        ),
      },
    ],
    [busyTicketId]
  );

  return (
    <>
      {pendingModal && (
        <ActionConfirmModal
          open
          title={pendingModal.action === 'investigating' ? '🔍 Mark as investigating' : pendingModal.action === 'resolve' ? '✅ Resolve ticket' : pendingModal.action === 'close' ? '🔒 Close ticket' : '🔄 Reopen ticket'}
          description={<>Update ticket <strong style={{ color: '#f1f5f9' }}>{pendingModal.ticket.subject ?? pendingModal.ticket.id.slice(0, 8) + '…'}</strong> for <strong style={{ color: '#f1f5f9' }}>{pendingModal.ticket.company_name}</strong>.</>}
          confirmLabel={pendingModal.action === 'investigating' ? 'Confirm investigation' : pendingModal.action === 'resolve' ? 'Confirm resolution' : pendingModal.action === 'close' ? 'Confirm close' : 'Confirm reopen'}
          danger={pendingModal.action === 'close'}
          reasonRequired
          reasonLabel="Reason"
          reasonPlaceholder="Explain why this action is required (minimum 5 characters)…"
          submitting={busyTicketId !== null}
          onCancel={() => setPendingModal(null)}
          onConfirm={(reason) => {
            const { ticket, action } = pendingModal;
            setPendingModal(null);
            void runAction(ticket, action, reason);
          }}
        />
      )}
      {inlineError && (
        <div style={{position:'fixed',top:'1rem',right:'1rem',zIndex:999,backgroundColor:'#7f1d1d',border:'1px solid #ef4444',borderRadius:'8px',padding:'0.75rem 1rem',color:'#fca5a5',fontSize:'0.82rem',maxWidth:'360px',cursor:'pointer'}} onClick={() => setInlineError(null)} role="alert">
          ⚠️ {inlineError} <span style={{ opacity: 0.6 }}>(click to dismiss)</span>
        </div>
      )}
      <SuperAdminLiveTablePage<Row>
        icon="🎫"
        title="Support Tickets"
        sectionLabel="Support"
        description="Ticket queue and SLA visibility across all companies."
        endpoint={`/api/super-admin/support?section=tickets&limit=250&reload=${reloadToken}`}
        summaryField="summary"
        noteField="note"
        emptyMessage="No support tickets found."
        entityLink={(row) => ({ entityType: 'ticket', entityId: row.id, label: 'Ticket Inspector' })}
        columns={columns}
      />
    </>
  );
}
