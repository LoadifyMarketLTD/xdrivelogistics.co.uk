'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { CANONICAL_ROLES, THEME, accessLevelBadge } from './rolesRegistry';

type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const scopeLabel = (role: CanonicalRole) => role.workspaceRole === 'platform_owner' ? 'Global' : 'Company';
const accessLabel = (role: CanonicalRole) => accessLevelBadge[role.accessLevel]?.label ?? role.accessLevel;

export default function Page() {
  const [selectedRole, setSelectedRole] = useState<CanonicalRole | null>(null);
  const [query, setQuery] = useState('');

  const roles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CANONICAL_ROLES;
    return CANONICAL_ROLES.filter((role) =>
      [role.label, role.description, role.workspaceRole, role.appRole]
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: THEME.text, margin: 0 }}>Roles &amp; Permissions</h1>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
              Manage workspace access by role. Technical capability IDs remain available only in Advanced details.
            </p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles"
            aria-label="Search roles"
            style={{ width: '220px', height: '34px', borderRadius: '5px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#0b1220', color: THEME.text, padding: '0 0.7rem', fontSize: '0.76rem', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ padding: '0.38rem 0.7rem', borderRadius: '5px', backgroundColor: '#1d57d8', color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}>Roles</span>
          <Link href="/super-admin/users" style={{ padding: '0.38rem 0.7rem', borderRadius: '5px', border: `1px solid ${THEME.cardBorder}`, color: THEME.text, textDecoration: 'none', fontSize: '0.72rem', fontWeight: 700 }}>Users</Link>
          <a href="#permission-groups" style={{ padding: '0.38rem 0.7rem', borderRadius: '5px', border: `1px solid ${THEME.cardBorder}`, color: THEME.text, textDecoration: 'none', fontSize: '0.72rem', fontWeight: 700 }}>Permission groups</a>
          <Link href="/super-admin/settings/audit-logs" style={{ padding: '0.38rem 0.7rem', borderRadius: '5px', border: `1px solid ${THEME.cardBorder}`, color: THEME.text, textDecoration: 'none', fontSize: '0.72rem', fontWeight: 700 }}>Audit</Link>
        </div>

        <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: THEME.cardBg }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              <thead>
                <tr style={{ backgroundColor: '#0b1220', borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {['Role', 'Scope', 'Users', 'Access level', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} style={{ padding: '0.65rem 0.8rem', textAlign: 'left', color: THEME.muted, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const badge = accessLevelBadge[role.accessLevel];
                  return (
                    <tr key={role.workspaceRole} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <span aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center', backgroundColor: '#0b1220', fontSize: '0.9rem' }}>{role.emoji}</span>
                          <div>
                            <div style={{ color: THEME.text, fontSize: '0.78rem', fontWeight: 800 }}>{role.label}</div>
                            <div style={{ color: THEME.muted, fontSize: '0.66rem', marginTop: '0.1rem', maxWidth: '360px' }}>{role.description}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#cbd5e1', fontSize: '0.74rem' }}>{scopeLabel(role)}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: THEME.muted, fontSize: '0.74rem' }}>—</td>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <span style={{ color: badge.color, backgroundColor: badge.bg, borderRadius: '4px', padding: '0.2rem 0.45rem', fontSize: '0.66rem', fontWeight: 800 }}>{accessLabel(role)}</span>
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem' }}><span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 800 }}>● Active</span></td>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <button type="button" onClick={() => setSelectedRole(role)} style={{ height: '30px', padding: '0 0.65rem', borderRadius: '4px', border: '1px solid #1d57d8', backgroundColor: 'rgba(29,87,216,0.12)', color: '#93c5fd', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>Manage</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {roles.length === 0 && <div style={{ padding: '1.5rem', textAlign: 'center', color: THEME.muted, fontSize: '0.8rem' }}>No roles match your search.</div>}
        </div>

        <section id="permission-groups" style={{ marginTop: '1rem', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', backgroundColor: '#0b1220', padding: '0.85rem' }}>
          <h2 style={{ margin: 0, color: THEME.text, fontSize: '0.85rem' }}>Permission groups</h2>
          <p style={{ margin: '0.2rem 0 0.7rem', color: THEME.muted, fontSize: '0.7rem' }}>Capabilities are grouped by business area in the Manage panel so operational permissions are readable without exposing implementation details first.</p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['Company', 'Commercial', 'Operations', 'Fleet', 'Compliance', 'Finance', 'Platform'].map((group) => (
              <span key={group} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', backgroundColor: THEME.cardBg, color: '#cbd5e1', padding: '0.3rem 0.5rem', fontSize: '0.68rem', fontWeight: 700 }}>{group}</span>
            ))}
          </div>
        </section>

        {selectedRole && (
          <div role="dialog" aria-modal="true" aria-label={`Manage ${selectedRole.label}`} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(2,6,23,0.72)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedRole(null)}>
            <aside style={{ width: 'min(560px, 94vw)', height: '100%', overflowY: 'auto', backgroundColor: '#111827', borderLeft: `1px solid ${THEME.cardBorder}`, boxShadow: '-18px 0 40px rgba(0,0,0,0.28)' }} onClick={(event) => event.stopPropagation()}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#111827', borderBottom: `1px solid ${THEME.cardBorder}`, padding: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: THEME.text, fontSize: '1rem', fontWeight: 800 }}>{selectedRole.label}</div>
                  <div style={{ color: THEME.muted, fontSize: '0.7rem', marginTop: '0.15rem' }}>{scopeLabel(selectedRole)} scope · {accessLabel(selectedRole)}</div>
                </div>
                <button type="button" onClick={() => setSelectedRole(null)} style={{ width: '30px', height: '30px', borderRadius: '4px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#0b1220', color: THEME.text, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ padding: '1rem' }}>
                <p style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.5, margin: '0 0 1rem' }}>{selectedRole.description}</p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {selectedRole.capabilityGroups.map((group) => (
                    <section key={group.label} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '7px', backgroundColor: '#0b1220', padding: '0.75rem' }}>
                      <div style={{ color: THEME.text, fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>{group.label}</div>
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        {group.capabilities.map((capability) => (
                          <div key={capability} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.7rem' }}>
                            <span>{capability.split('.').slice(-1)[0].replace(/_/g, ' ')}</span>
                            <span aria-hidden="true" style={{ color: '#22c55e', fontWeight: 900 }}>✓</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <details style={{ marginTop: '1rem', border: `1px solid ${THEME.cardBorder}`, borderRadius: '7px', backgroundColor: '#0b1220', padding: '0.75rem' }}>
                  <summary style={{ color: THEME.muted, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>Advanced technical details</summary>
                  <div style={{ marginTop: '0.65rem' }}>
                    <div style={{ color: THEME.muted, fontSize: '0.66rem', marginBottom: '0.3rem' }}>Workspace role</div>
                    <code style={{ color: '#93c5fd', fontSize: '0.66rem' }}>{selectedRole.workspaceRole}</code>
                    <div style={{ color: THEME.muted, fontSize: '0.66rem', margin: '0.65rem 0 0.3rem' }}>Application role</div>
                    <code style={{ color: '#93c5fd', fontSize: '0.66rem' }}>{selectedRole.appRole}</code>
                    <div style={{ color: THEME.muted, fontSize: '0.66rem', margin: '0.65rem 0 0.3rem' }}>Primary routes</div>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>{selectedRole.routeAccess.map((route) => <code key={route} style={{ color: '#64748b', fontSize: '0.64rem' }}>{route}</code>)}</div>
                  </div>
                </details>
              </div>
            </aside>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
