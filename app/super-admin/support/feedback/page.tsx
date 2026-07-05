'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  rating: number | null;
  category: string;
  message: string;
  page_url: string | null;
  created_at: string | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  bug: '🐛',
  feature_request: '💡',
  general: '💬',
  compliment: '🎉',
  other: '📝',
};

const STAR_COLOURS = ['', '#dc2626', '#f97316', '#eab308', '#84cc16', '#22c55e'];

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span style={{ fontSize: '0.75rem', color: '#64748b' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ fontSize: '0.9rem', color: s <= value ? STAR_COLOURS[value] : '#334155' }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="💬"
      title="User Feedback"
      sectionLabel="Support"
      description="In-app feedback submitted by platform users."
      endpoint="/api/super-admin/support?section=feedback&limit=250"
      summaryField="summary"
      emptyMessage="No user feedback submitted yet."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name ?? 'Unknown'}</span>,
        },
        {
          key: 'category',
          label: 'Category',
          render: (row) => (
            <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>
              {CATEGORY_EMOJI[row.category] ?? '📝'}{' '}
              {row.category.replace(/_/g, ' ')}
            </span>
          ),
        },
        {
          key: 'rating',
          label: 'Rating',
          render: (row) => <StarRating value={row.rating} />,
        },
        {
          key: 'message',
          label: 'Message',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', display: 'block', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.message}
            </span>
          ),
        },
        {
          key: 'page_url',
          label: 'Page',
          render: (row) => (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{row.page_url ?? '—'}</span>
          ),
        },
        {
          key: 'created_at',
          label: 'Submitted',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>
              {row.created_at ? formatDateTime(row.created_at) : '—'}
            </span>
          ),
        },
      ]}
    />
  );
}
