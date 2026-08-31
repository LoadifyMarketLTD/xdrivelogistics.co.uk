'use client';

import { useParams } from 'next/navigation';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { CANONICAL_ROLES } from '@/app/super-admin/settings/roles-permissions/rolesRegistry';
import type { PlatformEntityType } from '@/app/super-admin/_components/control-plane';

type Row = {
  id: string;
  user_id: string;
  workspace_role: string;
  company_id: string | null;
  company: string | null;
  name: string | null;
  email: string | null;
  status: string;
  authority_active: boolean;
  provenance: string[];
  created_at: string | null;
  operational_entity_type: 'driver' | null;
  operational_entity_id: string | null;
};

export default function Page() {
  const params = useParams<{ workspaceRole: string }>();
  const workspaceRole = decodeURIComponent(params?.workspaceRole ?? '').toLowerCase();
  const definition = CANONICAL_ROLES.find((role) => role.workspaceRole === workspaceRole);

  if (!definition) {
    return <div style={{ margin: '12px', border: '1px solid #D9E1EA', borderRadius: '4px', background: '#FFFFFF', padding: '18px', color: '#64748B', fontSize: '12px' }}>Unknown canonical workspace role.</div>;
  }

  return (
    <SuperAdminLiveTablePage<Row>
      icon={definition.emoji}
      title={`${definition.label} Authority`}
      sectionLabel="Canonical Roles"
      description={`${definition.description} Rows represent authoritative identity/grant evidence, not a fabricated database role.`}
      endpoint={`/api/super-admin/users/canonical?workspaceRole=${encodeURIComponent(workspaceRole)}`}
      summaryField="summary"
      diagnosticField="diagnosticNote"
      emptyMessage={`No ${definition.label} authority grants currently exist in the canonical sources.`}
      entityLink={(row) => {
        if (row.operational_entity_type === 'driver' && row.operational_entity_id) {
          return { entityType: 'driver', entityId: row.operational_entity_id, label: 'Driver' };
        }
        if (!row.user_id) return null;
        return { entityType: 'user' as PlatformEntityType, entityId: row.user_id, label: 'User' };
      }}
      columns={[
        {
          key: 'identity',
          label: 'Identity',
          render: (row) => <div><div style={{ fontWeight: 800 }}>{row.name ?? 'Unnamed user'}</div><div style={{ color: '#64748B', fontSize: '10px', marginTop: '2px' }}>{row.email ?? 'Email unavailable'}</div></div>,
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => row.company ?? 'Platform / no company',
        },
        {
          key: 'authority',
          label: 'Authority',
          render: (row) => <StatusChip value={row.authority_active ? 'active' : row.status || 'inactive'} />,
        },
        {
          key: 'sourceStatus',
          label: 'Source Status',
          render: (row) => row.status || '—',
        },
        {
          key: 'provenance',
          label: 'Provenance',
          render: (row) => <div style={{ maxWidth: '360px', display: 'grid', gap: '2px' }}>{row.provenance.map((source) => <code key={source} style={{ fontSize: '9px', color: '#64748B', overflowWrap: 'anywhere' }}>{source}</code>)}</div>,
        },
        {
          key: 'created',
          label: 'Granted / Created',
          render: (row) => formatDateTime(row.created_at),
        },
      ]}
    />
  );
}
