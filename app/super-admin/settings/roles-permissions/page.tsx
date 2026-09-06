'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { CANONICAL_ROLES, accessLevelBadge } from './rolesRegistry';

type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const X = {
  blue: '#1A73E8',
  green: '#34A853',
  white: '#FFFFFF',
  text: '#4A4A4A',
  background: '#F5F7FA',
  border: '#E0E3E7',
  grey: '#8A9099',
} as const;
const ENTERPRISE_SHADOW = '0px 2px 6px rgba(0,0,0,0.08)';

const scopeLabel = (role: CanonicalRole) => role.workspaceRole === 'platform_owner' ? 'Global' : 'Company';
const accessLabel = (role: CanonicalRole) => accessLevelBadge[role.accessLevel]?.label ?? role.accessLevel;

export default function Page() {
  const [selectedRole, setSelectedRole] = useState<CanonicalRole | null>(null);
  const [query, setQuery] = useState('');
  const roles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CANONICAL_ROLES;
    return CANONICAL_ROLES.filter(role => [role.label, role.description, role.workspaceRole, role.appRole].some(value => String(value).toLowerCase().includes(normalized)));
  }, [query]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div style={{ minHeight: '100vh', background: X.background, color: X.text, padding: '24px', fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: '14px' }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Access Matrix</h1>
          <p style={{ margin: '24px 0 0', color: X.text, fontSize: '14px' }}>Read-only canonical workspace roles, route boundaries and capability groups. Role assignment is intentionally managed outside this surface until audited mutation controls exist.</p>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search roles" aria-label="Search roles" style={{ width: '220px', minHeight: '40px', borderRadius: '8px', border: `1px solid ${X.border}`, background: X.white, color: X.text, padding: '0 14px', fontSize: '14px', outline: 'none' }} />
      </header>

      <nav aria-label="Access matrix workspace" style={{ minHeight: '40px', display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={tabStyle(true)}>Access Matrix</span>
        <a href="#permission-groups" style={tabStyle(false)}>Capability groups</a>
        <Link href="/super-admin/settings/audit-logs" style={tabStyle(false)}>Audit</Link>
      </nav>

      <section style={{ border: `1px solid ${X.border}`, borderRadius: '8px', background: X.white, overflow: 'hidden', boxShadow: ENTERPRISE_SHADOW }}>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
          <thead><tr style={{ background: X.background, borderBottom: `1px solid ${X.border}` }}>
            {['Role', 'Scope', 'Access level', 'Definition', 'Action'].map(h => <th key={h} style={{ padding: '24px', textAlign: 'left', color: X.blue, fontSize: '14px', fontWeight: 700 }}>{h}</th>)}
          </tr></thead>
          <tbody>{roles.map(role => {
            const badge = accessLevelBadge[role.accessLevel];
            return <tr key={role.workspaceRole} style={{ borderBottom: `1px solid ${X.border}` }}>
              <td style={{ padding: '24px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}><span aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: X.background, fontSize: '14px' }}>{role.emoji}</span><div><div style={{ color: X.blue, fontSize: '14px', fontWeight: 700 }}>{role.label}</div><div style={{ color: X.grey, fontSize: '14px', marginTop: '24px', maxWidth: '420px' }}>{role.description}</div></div></div></td>
              <td style={cellStyle}>{scopeLabel(role)}</td>
              <td style={{ padding: '24px' }}><span style={{ color: badge.color, background: badge.bg, borderRadius: '8px', padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}>{accessLabel(role)}</span></td>
              <td style={{ padding: '24px' }}><span style={{ color: X.green, fontSize: '14px', fontWeight: 700 }}>● Defined</span></td>
              <td style={{ padding: '24px' }}><button type="button" onClick={() => setSelectedRole(role)} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${X.blue}`, background: X.white, color: X.blue, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Inspect</button></td>
            </tr>;
          })}</tbody>
        </table></div>
        {roles.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: X.grey, fontSize: '14px' }}>No roles match your search.</div>}
      </section>

      <section id="permission-groups" style={{ marginTop: '24px', border: `1px solid ${X.border}`, borderRadius: '8px', background: X.white, padding: '24px', boxShadow: ENTERPRISE_SHADOW }}>
        <h2 style={{ margin: 0, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Capability groups</h2>
        <p style={{ margin: '24px 0', color: X.text, fontSize: '14px' }}>Business capabilities are grouped for readability. This surface documents the canonical authorization model; it does not mutate user authority.</p>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>{['Company', 'Commercial', 'Operations', 'Fleet', 'Compliance', 'Finance', 'Platform'].map(group => <span key={group} style={{ border: `1px solid ${X.border}`, borderRadius: '8px', background: X.background, color: X.blue, padding: '4px 10px', fontSize: '14px', fontWeight: 700 }}>{group}</span>)}</div>
      </section>

      {selectedRole && <div role="dialog" aria-modal="true" aria-label={`Inspect ${selectedRole.label}`} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,115,232,.12)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedRole(null)}>
        <aside style={{ width: 'min(520px,94vw)', height: '100%', overflowY: 'auto', background: X.white, borderLeft: `1px solid ${X.border}`, boxShadow: ENTERPRISE_SHADOW }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, minHeight: '52px', background: X.white, borderBottom: `1px solid ${X.border}`, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div><div style={{ color: X.blue, fontSize: '20px', fontWeight: 700 }}>{selectedRole.label}</div><div style={{ color: X.grey, fontSize: '14px', marginTop: '24px' }}>{scopeLabel(selectedRole)} scope · {accessLabel(selectedRole)}</div></div>
            <button type="button" aria-label="Close role inspection" onClick={() => setSelectedRole(null)} style={{ minWidth: '40px', minHeight: '40px', borderRadius: '8px', border: `1px solid ${X.border}`, background: X.white, color: X.blue, cursor: 'pointer', fontSize: '14px' }}>×</button>
          </div>
          <div style={{ padding: '24px' }}>
            <p style={{ color: X.text, fontSize: '14px', lineHeight: 1.5, margin: '0 0 24px' }}>{selectedRole.description}</p>
            <div style={{ display: 'grid', gap: '24px' }}>{selectedRole.capabilityGroups.map(group => <section key={group.label} style={{ border: `1px solid ${X.border}`, borderRadius: '8px', background: X.white, padding: '24px', boxShadow: ENTERPRISE_SHADOW }}><div style={{ color: X.blue, fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>{group.label}</div><div style={{ display: 'grid', gap: '24px' }}>{group.capabilities.map(capability => <div key={capability} style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', color: X.text, fontSize: '14px' }}><span>{capability.split('.').slice(-1)[0].replace(/_/g, ' ')}</span><span aria-hidden="true" style={{ color: X.green, fontWeight: 700 }}>✓</span></div>)}</div></section>)}</div>
            <details style={{ marginTop: '24px', border: `1px solid ${X.border}`, borderRadius: '8px', background: X.background, padding: '24px' }}><summary style={{ color: X.blue, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Advanced technical details</summary><div style={{ marginTop: '24px' }}><Tech label="Workspace role" value={selectedRole.workspaceRole} /><Tech label="Application role" value={selectedRole.appRole} /><div style={{ color: X.grey, fontSize: '14px', margin: '24px 0' }}>Primary routes</div><div style={{ display: 'grid', gap: '24px' }}>{selectedRole.routeAccess.map(route => <code key={route} style={{ color: X.grey, fontSize: '14px' }}>{route}</code>)}</div></div></details>
          </div>
        </aside>
      </div>}
    </div>
  </ProtectedRoute>;
}

const cellStyle = { padding: '24px', color: X.text, fontSize: '14px' } as const;
const tabStyle = (active: boolean) => ({ minHeight: '40px', display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: '8px', border: `1px solid ${active ? X.blue : X.border}`, background: active ? X.blue : X.white, color: active ? X.white : X.blue, textDecoration: 'none', fontSize: '14px', fontWeight: 700 } as const);
function Tech({ label, value }: { label: string; value: string }) { return <div style={{ marginBottom: '24px' }}><div style={{ color: X.grey, fontSize: '14px', marginBottom: '24px' }}>{label}</div><code style={{ color: X.blue, fontSize: '14px' }}>{value}</code></div>; }
