'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { CANONICAL_ROLES, accessLevelBadge } from './rolesRegistry';

type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF',
  charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#16A34A',
} as const;

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
    <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: X.navy, fontSize: '20px', fontWeight: 800 }}>Access Matrix</h1>
          <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Read-only canonical workspace roles, route boundaries and capability groups. Role assignment is intentionally managed outside this surface until audited mutation controls exist.</p>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search roles" aria-label="Search roles" style={{ width: '220px', height: '32px', borderRadius: '4px', border: `1px solid ${X.border}`, background: X.white, color: X.charcoal, padding: '0 10px', fontSize: '12px', outline: 'none' }} />
      </header>

      <nav aria-label="Access matrix workspace" style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={tabStyle(true)}>Access Matrix</span>
        <Link href="/super-admin/users" style={tabStyle(false)}>Users</Link>
        <a href="#permission-groups" style={tabStyle(false)}>Capability groups</a>
        <Link href="/super-admin/settings/audit-logs" style={tabStyle(false)}>Audit</Link>
      </nav>

      <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
          <thead><tr style={{ height: '38px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
            {['Role', 'Scope', 'Access level', 'Definition', 'Action'].map(h => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: X.navy, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>)}
          </tr></thead>
          <tbody>{roles.map(role => {
            const badge = accessLevelBadge[role.accessLevel];
            return <tr key={role.workspaceRole} style={{ minHeight: '44px', borderBottom: `1px solid ${X.border}` }}>
              <td style={{ padding: '9px 12px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '4px', display: 'grid', placeItems: 'center', background: X.light, fontSize: '14px' }}>{role.emoji}</span><div><div style={{ color: X.navy, fontSize: '12px', fontWeight: 800 }}>{role.label}</div><div style={{ color: X.muted, fontSize: '10px', marginTop: '2px', maxWidth: '420px' }}>{role.description}</div></div></div></td>
              <td style={cellStyle}>{scopeLabel(role)}</td>
              <td style={{ padding: '9px 12px' }}><span style={{ color: badge.color, background: badge.bg, borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: 800 }}>{accessLabel(role)}</span></td>
              <td style={{ padding: '9px 12px' }}><span style={{ color: X.success, fontSize: '11px', fontWeight: 800 }}>● Defined</span></td>
              <td style={{ padding: '9px 12px' }}><button type="button" onClick={() => setSelectedRole(role)} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${X.blue}`, background: X.white, color: X.blue, fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Inspect</button></td>
            </tr>;
          })}</tbody>
        </table></div>
        {roles.length === 0 && <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>No roles match your search.</div>}
      </section>

      <section id="permission-groups" style={{ marginTop: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '12px' }}>
        <h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Capability groups</h2>
        <p style={{ margin: '4px 0 8px', color: X.muted, fontSize: '11px' }}>Business capabilities are grouped for readability. This surface documents the canonical authorization model; it does not mutate user authority.</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{['Company', 'Commercial', 'Operations', 'Fleet', 'Compliance', 'Finance', 'Platform'].map(group => <span key={group} style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.light, color: X.navy, padding: '4px 7px', fontSize: '10px', fontWeight: 700 }}>{group}</span>)}</div>
      </section>

      {selectedRole && <div role="dialog" aria-modal="true" aria-label={`Inspect ${selectedRole.label}`} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(11,47,107,.25)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedRole(null)}>
        <aside style={{ width: 'min(520px,94vw)', height: '100%', overflowY: 'auto', background: X.white, borderLeft: `1px solid ${X.border}`, boxShadow: '-14px 0 30px rgba(11,47,107,.16)' }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, minHeight: '52px', background: X.white, borderBottom: `1px solid ${X.border}`, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div><div style={{ color: X.navy, fontSize: '16px', fontWeight: 800 }}>{selectedRole.label}</div><div style={{ color: X.muted, fontSize: '11px', marginTop: '2px' }}>{scopeLabel(selectedRole)} scope · {accessLabel(selectedRole)}</div></div>
            <button type="button" onClick={() => setSelectedRole(null)} style={{ width: '32px', height: '32px', borderRadius: '4px', border: `1px solid ${X.border}`, background: X.white, color: X.navy, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '12px' }}>
            <p style={{ color: X.charcoal, fontSize: '12px', lineHeight: 1.5, margin: '0 0 12px' }}>{selectedRole.description}</p>
            <div style={{ display: 'grid', gap: '8px' }}>{selectedRole.capabilityGroups.map(group => <section key={group.label} style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '10px' }}><div style={{ color: X.navy, fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>{group.label}</div><div style={{ display: 'grid', gap: '4px' }}>{group.capabilities.map(capability => <div key={capability} style={{ minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: X.charcoal, fontSize: '11px' }}><span>{capability.split('.').slice(-1)[0].replace(/_/g, ' ')}</span><span aria-hidden="true" style={{ color: X.success, fontWeight: 900 }}>✓</span></div>)}</div></section>)}</div>
            <details style={{ marginTop: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.light, padding: '10px' }}><summary style={{ color: X.navy, fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Advanced technical details</summary><div style={{ marginTop: '8px' }}><Tech label="Workspace role" value={selectedRole.workspaceRole} /><Tech label="Application role" value={selectedRole.appRole} /><div style={{ color: X.muted, fontSize: '10px', margin: '8px 0 4px' }}>Primary routes</div><div style={{ display: 'grid', gap: '3px' }}>{selectedRole.routeAccess.map(route => <code key={route} style={{ color: X.muted, fontSize: '10px' }}>{route}</code>)}</div></div></details>
          </div>
        </aside>
      </div>}
    </div>
  </ProtectedRoute>;
}

const cellStyle = { padding: '9px 12px', color: X.charcoal, fontSize: '11px' } as const;
const tabStyle = (active: boolean) => ({ height: '32px', display: 'inline-flex', alignItems: 'center', padding: '0 10px', borderRadius: '4px', border: `1px solid ${active ? X.blue : X.border}`, background: active ? X.blue : X.white, color: active ? X.white : X.navy, textDecoration: 'none', fontSize: '11px', fontWeight: 800 } as const);
function Tech({ label, value }: { label: string; value: string }) { return <div style={{ marginBottom: '7px' }}><div style={{ color: X.muted, fontSize: '10px', marginBottom: '2px' }}>{label}</div><code style={{ color: X.blue, fontSize: '10px' }}>{value}</code></div>; }
