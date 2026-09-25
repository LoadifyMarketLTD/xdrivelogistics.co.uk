'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminDataGrid,
  SuperAdminEmptyState,
  SuperAdminFilterBar,
  SuperAdminPage,
  SuperAdminPageHeader,
  SuperAdminPager,
  SuperAdminSectionCard,
  SuperAdminStatusBadge,
  SuperAdminUnavailableState,
  type EnterpriseTone,
  type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

const PAGE_SIZE = 50;

export type UserRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  status?: string;
  role: string;
  company?: string;
  company_id?: string | null;
  availability_status?: string;
  app_access?: boolean;
  phone?: string;
  created_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type ApiResponse = { rows: UserRow[]; total: number; pagination?: Pagination };
type Column = { label: string; render: (row: UserRow) => ReactNode };
type Props = {
  icon?: ReactNode;
  title: string;
  description: string;
  section: string;
  roleFilter: string;
  columns: Column[];
};

export const fmt = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '?';

function statusTone(status: string | undefined): EnterpriseTone {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'active' || normalized === 'available') return 'success';
  if (normalized === 'suspended' || normalized === 'inactive') return 'danger';
  if (normalized === 'busy') return 'info';
  return 'unavailable';
}

export const statusDot = (status: string | undefined) => (
  <SuperAdminStatusBadge label={(status || 'unknown').replaceAll('_', ' ')} tone={statusTone(status)} />
);

export default function SuperAdminUserListPage({ icon, title, description, section, roleFilter, columns }: Props) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    setTotal(0);
    setHasNextPage(false);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (roleFilter) params.set('role', roleFilter);
      const response = await fetch(`/api/super-admin/users?${params.toString()}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((body as { error?: string }).error ?? 'User service is currently unavailable.');
        return;
      }
      const data = body as Partial<ApiResponse>;
      const nextRows = data.rows ?? [];
      const nextTotal = data.total ?? 0;
      setRows(nextRows);
      setTotal(nextTotal);
      setHasNextPage(data.pagination?.hasNextPage ?? page * PAGE_SIZE < nextTotal);
    } catch {
      setError('User service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); setFilter(''); }, [roleFilter]);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.name, row.email, row.company ?? '', row.role]
      .some((value) => value.toLowerCase().includes(term)));
  }, [filter, rows]);

  const dataColumns = useMemo<SuperAdminDataColumn<UserRow>[]>(() => [
    ...columns.map((column, index) => ({ key: `column-${index}`, label: column.label, render: column.render })),
    {
      key: 'inspect',
      label: 'Inspect',
      render: (row) => row.user_id
        ? <PlatformEntityLink entityType="user" entityId={row.user_id} compact>Open</PlatformEntityLink>
        : <span>Invite only</span>,
    },
  ], [columns]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminPage>
        <SuperAdminPageHeader
          eyebrow={`${section} ? Platform Control`}
          title={title}
          description={description}
          icon={icon}
          meta={<span>{loading ? 'Loading verified registry?' : error ? 'Registry unavailable' : `${total.toLocaleString()} total ? server-side pagination`}</span>}
          actions={(
            <button type="button" onClick={() => void fetchUsers()} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" />
              {loading ? 'Loading?' : 'Refresh'}
            </button>
          )}
        />

        {error ? (
          <SuperAdminUnavailableState title={`${title} unavailable`} description={error} />
        ) : (
          <>
            <SuperAdminFilterBar>
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter current page by name, email or company?"
                aria-label="Filter current page"
              />
              <SuperAdminStatusBadge label={`Page ${page}`} tone="info" />
            </SuperAdminFilterBar>

            <SuperAdminSectionCard
              title={`${title} registry`}
              description="Platform Owner view. Current-page filtering never changes canonical server totals."
              flush
            >
              {loading ? (
                <div style={{ padding: 18 }}>Loading verified users?</div>
              ) : filtered.length === 0 ? (
                <SuperAdminEmptyState
                  title={filter ? 'No records match the current-page filter' : `No ${title.toLowerCase()} found`}
                  description={filter ? 'Clear or change the filter to see other records on this page.' : undefined}
                />
              ) : (
                <SuperAdminDataGrid columns={dataColumns} rows={filtered} rowKey={(row) => row.id} minWidth={980} />
              )}
              {!loading && (page > 1 || hasNextPage) ? (
                <SuperAdminPager
                  page={page}
                  totalCount={total}
                  canPrev={page > 1}
                  canNext={hasNextPage}
                  onPrev={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => current + 1)}
                />
              ) : null}
            </SuperAdminSectionCard>
          </>
        )}
      </SuperAdminPage>
    </ProtectedRoute>
  );
}
