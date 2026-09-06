'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';

type Row = {
  id: string;
  company_name: string;
  type: string | null;
  severity: string | null;
  status: string;
  created_at: string | null;
};

const actionButtonStyle = {
  minHeight: '40px',
  padding: '24px',
  borderRadius: '8px',
  border: '1px solid #E0E3E7',
  background: '#FFFFFF',
  color: '#1A73E8',
  fontFamily: 'Inter, Roboto, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 700,
} as const;

export default function Page() {
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [pendingResolve, setPendingResolve] = useState<Row | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const resolveTicket = async (ticket: Row, reason: string) => {
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
        action: 'resolve',
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

  const columns = useMemo(
    () => [
      {
        key: 'ticket_id',
        label: 'Ticket ID',
        render: (row: Row) => (
          <div style={{ display: 'grid', gap: '24px' }}>
            <code style={{ color: '#4A4A4A', fontSize: '14px' }}>{row.id}</code>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <PlatformEntityLink entityType="ticket" entityId={row.id} compact>Open</PlatformEntityLink>
              <button
                type="button"
                aria-disabled="true"
                title="Assign is visual-only because the current backend does not expose an Assign mutation."
                style={{ ...actionButtonStyle, cursor: 'not-allowed', opacity: 0.55 }}
                onClick={(event) => event.preventDefault()}
              >
                Assign
              </button>
              <button
                type="button"
                disabled={busyTicketId === row.id}
                onClick={() => setPendingResolve(row)}
                style={{ ...actionButtonStyle, cursor: busyTicketId === row.id ? 'not-allowed' : 'pointer' }}
              >
                Resolve
              </button>
            </div>
          </div>
        ),
      },
      {
        key: 'company',
        label: 'Company',
        render: (row: Row) => row.company_name ?? 'Unknown',
      },
      {
        key: 'type',
        label: 'Type',
        render: (row: Row) => row.type ?? '—',
      },
      {
        key: 'severity',
        label: 'Severity',
        render: (row: Row) => row.severity ?? '—',
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: Row) => <StatusChip value={row.status} />,
      },
      {
        key: 'created',
        label: 'Created',
        render: (row: Row) => row.created_at ? formatDateTime(row.created_at) : '—',
      },
    ],
    [busyTicketId],
  );

  return (
    <>
      <ActionConfirmModal
        open={pendingResolve !== null}
        title="Resolve ticket"
        description={<>Resolve ticket <strong>{pendingResolve?.id}</strong> for <strong>{pendingResolve?.company_name}</strong>.</>}
        confirmLabel="Resolve"
        reasonRequired
        reasonLabel="Reason"
        reasonPlaceholder="Explain why this ticket is being resolved (minimum 5 characters)…"
        submitting={busyTicketId !== null}
        onCancel={() => setPendingResolve(null)}
        onConfirm={(reason) => {
          if (!pendingResolve) return;
          const ticket = pendingResolve;
          setPendingResolve(null);
          void resolveTicket(ticket, reason);
        }}
      />

      {inlineError && (
        <div
          style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 999,
            backgroundColor: '#FFFFFF', border: '1px solid #EA4335',
            borderRadius: '8px', padding: '24px',
            boxShadow: '0px 2px 6px rgba(0,0,0,0.08)',
            color: '#EA4335', fontSize: '14px', maxWidth: '360px',
            cursor: 'pointer',
          }}
          onClick={() => setInlineError(null)}
          role="alert"
        >
          {inlineError}
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
        columns={columns}
      />
    </>
  );
}
