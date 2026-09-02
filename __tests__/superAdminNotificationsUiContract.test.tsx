import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('../app/super-admin/_lib/getAuthHeader', () => ({
  getAuthHeader: vi.fn(async () => 'token'),
}));

import {
  SuperAdminLiveTableView,
  readLiveTableNotices,
  type LiveTableNotice,
  type TableColumn,
} from '../app/super-admin/_components/SuperAdminLiveTablePage';
import {
  createNotificationColumns,
  notificationsTableProps,
  performNotificationRetry,
  type RetryFeedback,
  type NotificationRow,
} from '../app/super-admin/notifications/_lib/notificationsPage';

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const sampleColumns: TableColumn<{ id: string; value: string }>[] = [
  {
    key: 'value',
    label: 'Value',
    render: (row) => row.value,
  },
];

const sampleNotificationRow: NotificationRow = {
  id: 'evt-1',
  user_id: 'user-1',
  type: 'job_assigned',
  title: 'Job assigned',
  message: 'LOAD-1',
  status: 'failed',
  processed: true,
  created_at: '2026-08-01T12:00:00.000Z',
  last_error: 'Provider timeout',
  attempt_count: null,
  next_attempt_at: null,
};

describe('super-admin live table view', () => {
  it('reads both note and diagnostic fields from the API body', () => {
    expect(
      readLiveTableNotices(
        { note: 'Primary note', diagnosticNote: 'error detail unavailable' },
        'note',
        'diagnosticNote',
      ),
    ).toEqual<LiveTableNotice[]>([
      { kind: 'note', message: 'Primary note' },
      { kind: 'diagnostic', message: 'error detail unavailable' },
    ]);
  });

  it('renders diagnostic notice content for degraded-schema fallback responses', () => {
    const html = render(
      <SuperAdminLiveTableView
        icon="🔔"
        title="System Notifications"
        sectionLabel="Platform"
        description="Canonical notification event queue."
        columns={sampleColumns}
        emptyMessage="No notifications found."
        loading={false}
        error={null}
        notices={[{ kind: 'diagnostic', message: 'error detail unavailable — durability columns have not been applied' }]}
        summary={{ total: 1 }}
        rows={[{ id: '1', value: 'row-1' }]}
        page={1}
        hasNextPage={false}
        totalCount={1}
        onPrevPage={() => undefined}
        onNextPage={() => undefined}
      />,
    );

    expect(html).toContain('error detail unavailable');
    expect(html).toContain('durability columns have not been applied');
  });

  it('renders an error state without empty or healthy summary cards', () => {
    const html = render(
      <SuperAdminLiveTableView
        icon="🔔"
        title="System Notifications"
        sectionLabel="Platform"
        description="Canonical notification event queue."
        columns={sampleColumns}
        emptyMessage="No notifications found."
        loading={false}
        error="Failed to load notification events."
        notices={[]}
        summary={{ total: 0, healthy: 0 }}
        rows={[]}
        page={1}
        hasNextPage={false}
        totalCount={0}
        onPrevPage={() => undefined}
        onNextPage={() => undefined}
      />,
    );

    expect(html).toContain('Failed to load notification events.');
    expect(html).toContain('Service temporarily unavailable');
    expect(html).not.toContain('No notifications found.');
    expect(html).not.toContain('healthy');
  });
});

describe('notifications page contract', () => {
  it('declares both source-note and diagnostic-note fields', () => {
    expect(notificationsTableProps.noteField).toBe('note');
    expect(notificationsTableProps.diagnosticField).toBe('diagnosticNote');
  });

  it('renders nullable attempt counts safely', () => {
    const columns = createNotificationColumns({
      pendingById: {},
      feedbackById: {},
      onRetry: () => undefined,
    });
    const failureDetail = columns.find((column) => column.key === 'failure_detail');
    if (!failureDetail) throw new Error('failure_detail column missing');

    const html = render(React.createElement(React.Fragment, null, failureDetail.render(sampleNotificationRow)));
    expect(html).toContain('Attempts: —');
    expect(html).not.toContain('Attempts: null');
  });

  it('renders visible pending feedback and blocks duplicate retry submissions', () => {
    const columns = createNotificationColumns({
      pendingById: { 'evt-1': true },
      feedbackById: {},
      onRetry: () => undefined,
    });
    const actionColumn = columns.find((column) => column.key === 'actions');
    if (!actionColumn) throw new Error('actions column missing');

    const html = render(React.createElement(React.Fragment, null, actionColumn.render(sampleNotificationRow)));
    expect(html).toContain('Retrying…');
    expect(html).toContain('disabled');
  });

  it('renders visible retry error feedback', () => {
    const feedbackById: Record<string, RetryFeedback | undefined> = {
      'evt-1': { tone: 'error', message: 'Notification retry failed.' },
    };
    const columns = createNotificationColumns({
      pendingById: {},
      feedbackById,
      onRetry: () => undefined,
    });
    const actionColumn = columns.find((column) => column.key === 'actions');
    if (!actionColumn) throw new Error('actions column missing');

    const html = render(React.createElement(React.Fragment, null, actionColumn.render(sampleNotificationRow)));
    expect(html).toContain('Notification retry failed.');
  });

  it('renders visible retry success feedback', () => {
    const feedbackById: Record<string, RetryFeedback | undefined> = {
      'evt-1': { tone: 'success', message: 'Retry queued and audit recorded.' },
    };
    const columns = createNotificationColumns({
      pendingById: {},
      feedbackById,
      onRetry: () => undefined,
    });
    const actionColumn = columns.find((column) => column.key === 'actions');
    if (!actionColumn) throw new Error('actions column missing');

    const html = render(React.createElement(React.Fragment, null, actionColumn.render(sampleNotificationRow)));
    expect(html).toContain('Retry queued and audit recorded.');
  });

  it('requires an explicit reason before submitting a retry', async () => {
    const fetchImpl = vi.fn();
    const feedback = await performNotificationRetry({
      notificationId: 'evt-1',
      reason: 'bad',
      getAuthHeaderImpl: async () => '******',
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(feedback).toEqual({ tone: 'error', message: 'Enter a retry reason of at least 5 characters.' });
  });

  it('calls the refresh callback after a successful governed retry request', async () => {
    const onSuccess = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

    const feedback = await performNotificationRetry({
      notificationId: 'evt-1',
      reason: 'Provider recovered; retry approved.',
      getAuthHeaderImpl: async () => '******',
      fetchImpl,
      onSuccess,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(String(init.body)).toContain('Provider recovered; retry approved.');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(feedback).toEqual({ tone: 'success', message: 'Retry queued and audit recorded.' });
  });

  it('surfaces a safe retry denial from the governed endpoint', async () => {
    const feedback = await performNotificationRetry({
      notificationId: 'evt-1',
      reason: 'Retry after provider recovery.',
      getAuthHeaderImpl: async () => '******',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Notification cannot be retried from status sent.' }), { status: 409 }),
    });

    expect(feedback).toEqual({ tone: 'error', message: 'Notification cannot be retried from status sent.' });
  });
});
