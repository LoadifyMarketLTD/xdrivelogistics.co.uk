'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

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

  const runAction = async (ticket: Row, action: 'investigating' | 'resolve' | 'close' | 'reopen') => {
    setBusyTicketId(ticket.id);
    const auth = await getAuthHeader();
    if (!auth) {
      setBusyTicketId(null);
      return;
    }

    const note = window.prompt('Optional note for this support action:', '') ?? '';
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
        note: note.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      window.alert(payload.error ?? `Action failed (${response.status})`);
    } else {
      setReloadToken(Date.now());
    }
    setBusyTicketId(null);
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
            <button type="button" disabled={busyTicketId === row.id} onClick={() => void runAction(row, 'investigating')} style={{ fontSize: '0.68rem' }}>
              Investigate
            </button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => void runAction(row, 'resolve')} style={{ fontSize: '0.68rem' }}>
              Resolve
            </button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => void runAction(row, 'close')} style={{ fontSize: '0.68rem' }}>
              Close
            </button>
            <button type="button" disabled={busyTicketId === row.id} onClick={() => void runAction(row, 'reopen')} style={{ fontSize: '0.68rem' }}>
              Reopen
            </button>
          </div>
        ),
      },
    ],
    [busyTicketId]
  );

  return (
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
  );
}
