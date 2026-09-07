'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { CANONICAL_ROLES } from './rolesRegistry';
import {
  SuperAdminDataGrid, SuperAdminEmptyState, SuperAdminFilterBar, SuperAdminNotice,
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminStatusBadge,
  type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type CanonicalRole = (typeof CANONICAL_ROLES)[number];
const scopeLabel = (role: CanonicalRole) => role.workspaceRole === 'platform_owner' ? 'Global' : 'Company';
const toneFor = (role: CanonicalRole) => role.accessLevel === 'platform' ? 'warning' : role.accessLevel === 'limited' ? 'neutral' : 'info';

export default function Page() {
  const [selectedRole, setSelectedRole] = useState<CanonicalRole | null>(null);
  const [query, setQuery] = useState('');
  const roles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? CANONICAL_ROLES.filter((role) => [role.label, role.description, role.workspaceRole, role.appRole].some((value) => String(value).toLowerCase().includes(normalized))) : CANONICAL_ROLES;
  }, [query]);

  const columns: SuperAdminDataColumn<CanonicalRole>[] = [
    { key: 'role', label: 'Role', render: (role) => <div><strong>{role.label}</strong><div style={{ color: '#64748B', marginTop: 3, fontSize: 11 }}>{role.description}</div></div> },
    { key: 'scope', label: 'Scope', render: (role) => scopeLabel(role) },
    { key: 'access', label: 'Access level', render: (role) => <SuperAdminStatusBadge label={role.accessLevel.replaceAll('_', ' ')} tone={toneFor(role)} /> },
    { key: 'app', label: 'Application role', render: (role) => <code>{role.appRole}</code> },
    { key: 'action', label: 'Action', render: (role) => <button type="button" className="sa-button" onClick={() => setSelectedRole(role)}>Inspect</button> },
  ];
  return <ProtectedRoute allowedRoles={['owner']}>
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Platform"
        title="Access Matrix"
        description="Read-only canonical workspace roles, route boundaries and capability groups. Role assignment remains outside this surface until audited mutation controls exist."
        icon={<ShieldCheck size={20} aria-hidden="true" />}
      />
      <SuperAdminNotice tone="info">Profile role and tenant membership authority remain separate. This page documents authorization; it does not mutate user authority.</SuperAdminNotice>
      <SuperAdminFilterBar>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, workspace or app role…" aria-label="Search roles" style={{ minHeight: 36, minWidth: 280, flex: 1, border: '1px solid #D9E1EA', borderRadius: 8, padding: '0 10px' }} />
      </SuperAdminFilterBar>
      <SuperAdminSectionCard title="Canonical roles" description={`${roles.length} role definition(s) in this view.`} flush>
        {roles.length ? <SuperAdminDataGrid columns={columns} rows={roles} rowKey={(role) => role.workspaceRole} minWidth={900} /> : <SuperAdminEmptyState title="No roles match your search." />}
      </SuperAdminSectionCard>
      <SuperAdminSectionCard title="Capability groups" description="Business capabilities are grouped for readability; the source remains the canonical workspace capability registry.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Company management', 'Commercial', 'Jobs & operations', 'Fleet', 'Documents & compliance', 'Finance', 'Platform'].map((group) => <SuperAdminStatusBadge key={group} label={group} tone="neutral" />)}
        </div>
      </SuperAdminSectionCard>

      {selectedRole ? <div role="dialog" aria-modal="true" aria-label={`Inspect ${selectedRole.label}`} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,27,60,.28)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedRole(null)}>
        <aside style={{ width: 'min(560px,94vw)', height: '100%', overflowY: 'auto', background: '#FFFFFF', borderLeft: '1px solid #D9E1EA', boxShadow: '-16px 0 44px rgba(7,27,60,.18)' }} onClick={(event) => event.stopPropagation()}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#FFFFFF', borderBottom: '1px solid #D9E1EA', padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ color: '#0B2F6B', fontSize: 18 }}>{selectedRole.label}</strong><div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{scopeLabel(selectedRole)} scope · {selectedRole.accessLevel}</div></div>
            <button type="button" className="sa-button" aria-label="Close role inspection" onClick={() => setSelectedRole(null)}>Close</button>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ color: '#334155', lineHeight: 1.55, marginTop: 0 }}>{selectedRole.description}</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {selectedRole.capabilityGroups.map((group) => <SuperAdminSectionCard key={group.label} title={group.label}>
                <div style={{ display: 'grid', gap: 6 }}>{group.capabilities.map((capability) => <code key={capability} style={{ color: '#334155', fontSize: 12 }}>{capability}</code>)}</div>
              </SuperAdminSectionCard>)}
            </div>
            <SuperAdminSectionCard title="Technical identity" description="Read-only canonical identifiers and primary route access.">
              <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                <div><strong>Workspace role:</strong> <code>{selectedRole.workspaceRole}</code></div>
                <div><strong>Application role:</strong> <code>{selectedRole.appRole}</code></div>
                <div><strong>Routes:</strong></div>
                {selectedRole.routeAccess.map((route) => <code key={route}>{route}</code>)}
              </div>
            </SuperAdminSectionCard>
          </div>
        </aside>
      </div> : null}
    </SuperAdminPage>
  </ProtectedRoute>;
}
