'use client';

import ProtectedRoute from '../../../components/ProtectedRoute';
import { CANONICAL_ROLES, THEME, accessLevelBadge } from './rolesRegistry';

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>
                Roles &amp; Permissions
              </h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Settings
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Generated read-only view of the canonical workspace registry used by runtime navigation and capability gates.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem', border: `1px solid ${THEME.warning}`, borderLeft: `4px solid ${THEME.warning}`, borderRadius: '8px', backgroundColor: 'rgba(251,191,36,0.06)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.9rem' }}>⚠️</span>
            <span style={{ color: THEME.warning, fontWeight: 700, fontSize: '0.82rem' }}>Canonical generated matrix</span>
          </div>
          <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
            Capability chips are derived from <code style={{ color: THEME.warning, fontSize: '0.73rem' }}>getWorkspaceCapabilities()</code> and route chips are derived from the runtime workspace definitions. They describe visible workspace entry points, not server-side RLS or API authorisation on their own.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {Object.entries(accessLevelBadge).map(([level, badge]) => {
            const count = CANONICAL_ROLES.filter((role) => role.accessLevel === level).length;
            return (
              <div key={level} style={{ backgroundColor: badge.bg, border: `1px solid ${badge.color}33`, borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: badge.color, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em' }}>{badge.label}</span>
                <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>{count} role{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
          <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: THEME.text, fontSize: '0.7rem', fontWeight: 700 }}>TOTAL</span>
            <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>{CANONICAL_ROLES.length} workspace roles</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '0.75rem' }}>
          {CANONICAL_ROLES.map((role) => {
            const badge = accessLevelBadge[role.accessLevel];
            return (
              <div
                key={role.workspaceRole}
                style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${role.color}`, borderRadius: '10px', padding: '1rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '1rem' }}>{role.emoji}</span>
                      <span style={{ color: role.color, fontWeight: 700, fontSize: '0.92rem' }}>{role.label}</span>
                    </div>
                    <code style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', backgroundColor: '#0b1220', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                      workspaceRole: {role.workspaceRole}
                    </code>
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: badge.color, backgroundColor: badge.bg, padding: '0.15rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {badge.label}
                  </span>
                </div>

                <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  {role.description}
                </p>

                <div style={{ marginBottom: '0.65rem' }}>
                  <span style={{ color: THEME.muted, fontSize: '0.68rem', fontWeight: 700 }}>APP ROLE: </span>
                  <code style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>{role.appRole}</code>
                </div>

                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {role.capabilityGroups.map((group) => (
                    <div key={group.label}>
                      <div style={{ color: THEME.muted, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                        {group.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {group.capabilities.map((capability) => (
                          <span
                            key={capability}
                            style={{ fontSize: '0.62rem', fontFamily: 'monospace', backgroundColor: '#0b1220', border: `1px solid ${role.color}22`, color: '#94a3b8', padding: '0.12rem 0.4rem', borderRadius: '3px' }}
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ color: THEME.muted, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                    Primary workspace routes
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {role.routeAccess.map((route) => (
                      <span
                        key={route}
                        style={{ fontSize: '0.62rem', fontFamily: 'monospace', backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, color: '#64748b', padding: '0.12rem 0.4rem', borderRadius: '3px' }}
                      >
                        {route}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', backgroundColor: '#0b1220' }}>
          <p style={{ color: THEME.muted, fontSize: '0.76rem', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: THEME.text }}>Source of truth:</strong>{' '}
            <code style={{ color: THEME.accent, fontSize: '0.73rem' }}>lib/workspaceRole.ts</code> capability sets and workspace definitions, plus the shared super-admin shell definition for platform owner navigation.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
