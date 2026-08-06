import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActionCard,
  ComplianceSummaryPanel,
  EmptyState,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  OperationalTable,
  SavedViewSelector,
  WorkspaceActivityFeed,
} from '../app/components/workspace/WorkspaceUI';

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('workspace operational primitives', () => {
  it('renders ExchangeKpiStrip using KPI card content', () => {
    const html = render(
      <ExchangeKpiStrip>
        <KpiCard label="Active jobs" value={12} />
      </ExchangeKpiStrip>,
    );

    expect(html).toContain('Active jobs');
    expect(html).toContain('12');
    expect(html).toContain('Operational key performance indicators');
  });

  it('renders FinancialSummaryPanel rows', () => {
    const html = render(
      <FinancialSummaryPanel
        items={[
          { label: 'Invoiced revenue (net)', value: '£1,250.00', color: '#166534', background: '#f0fdf4' },
          { label: 'Estimated carrier quote cost', value: '£930.00', color: '#c2410c', background: '#fff7ed' },
        ]}
      />,
    );

    expect(html).toContain('Invoiced revenue (net)');
    expect(html).toContain('Estimated carrier quote cost');
  });

  it('renders ActionCard using the shared workspace card contract', () => {
    const html = render(
      <ActionCard
        label="Review submitted quotes"
        description="Carrier pricing workflow"
        actionLabel="Open workflow"
      />,
    );

    expect(html).toContain('Review submitted quotes');
    expect(html).toContain('Carrier pricing workflow');
    expect(html).toContain('Open workflow');
  });

  it('renders ComplianceSummaryPanel values and percentages', () => {
    const html = render(
      <ComplianceSummaryPanel
        total={10}
        rows={[
          { label: 'Fully compliant', count: 8, color: '#166534', background: '#ecfdf3', border: '#bbf7d0' },
          { label: 'About to expire', count: 1, color: '#92400e', background: '#fffbeb', border: '#fde68a' },
          { label: 'Updates needed', count: 1, color: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
        ]}
      />, 
    );

    expect(html).toContain('Fully compliant');
    expect(html).toContain('80%');
  });

  it('renders WorkspaceActivityFeed with references and errors', () => {
    const html = render(
      <WorkspaceActivityFeed
        items={[
          { id: 'evt-1', label: 'Job updated', reference: 'LOAD-2041', created_at: '2026-08-01T12:00:00.000Z', href: '/admin/jobs/abc' },
        ]}
        error=""
        classNames={{
          root: 'root',
          title: 'title',
          track: 'track',
          item: 'item',
          time: 'time',
          error: 'error',
        }}
        labelColor="#F5A300"
        timeColor="#F5A300"
        background="#0B2F6B"
      />,
    );

    expect(html).toContain('ACTIVITY');
    expect(html).toContain('Job updated');
    expect(html).toContain('LOAD-2041');
    expect(html).toContain('Open activity item');
  });

  it('renders SavedViewSelector options', () => {
    const html = render(
      <SavedViewSelector
        value="all"
        onChange={() => undefined}
        options={[
          { value: 'all', label: 'All loads' },
          { value: 'priority', label: 'Priority only' },
        ]}
      />,
    );

    expect(html).toContain('All loads');
    expect(html).toContain('Priority only');
    expect(html).toContain('Saved view');
  });

  it('renders OperationalTable sorted rows and semantic status', () => {
    const html = render(
      <OperationalTable
        columns={[
          { id: 'job', header: 'Job', cell: (row: { job: string }) => row.job },
          {
            id: 'status',
            header: 'Status',
            sortable: true,
            sortValue: (row: { status: string }) => row.status,
            semanticStatus: true,
            cell: (row: { status: string }) => row.status,
          },
        ]}
        rows={[
          { id: '2', job: 'LON-MAN', status: 'pending' },
          { id: '1', job: 'MAN-LON', status: 'delivered' },
        ]}
        getRowKey={(row) => row.id}
        sort={{ columnId: 'status', direction: 'asc' }}
      />,
    );

    expect(html).toContain('Sort by Status');
    expect(html).toContain('Delivered');
  });

  it('renders OperationalTable loading and error states', () => {
    const loading = render(
      <OperationalTable columns={[]} rows={[]} getRowKey={() => 'row'} loading />,
    );
    const error = render(
      <OperationalTable columns={[]} rows={[]} getRowKey={() => 'row'} error="Feed unavailable" />,
    );

    expect(loading).toContain('Loading records');
    expect(error).toContain('Feed unavailable');
  });

  it('renders compact EmptyState with description and action', () => {
    const html = render(
      <EmptyState
        compact
        title="No expiry alerts"
        description="No driver or vehicle document expires within 30 days."
        action={<button type="button">View all</button>}
      />,
    );

    expect(html).toContain('No expiry alerts');
    expect(html).toContain('No driver or vehicle document expires within 30 days.');
    expect(html).toContain('View all');
  });
});
