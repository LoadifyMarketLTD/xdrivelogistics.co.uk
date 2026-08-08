'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../../components/AuthContext';
import SharedContextControls from '../../components/workspace/SharedContextControls';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getActionCentreRoute,
  getNotificationsRoute,
  resolveActionCentreRole,
} from '../../components/workspace/actionCentreConfig';
import { workspaceTheme } from '../../components/workspace/WorkspaceUI';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';

const HEADER_HEIGHT = 54;
const NAV_HEIGHT = 48;

export default function SuperAdminTopNavigationShell({
  children,
  definition,
  fixtureOverrides,
}: {
  children: ReactNode;
  definition: WorkspaceDefinition;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(fixtureOverrides?.unreadCount ?? 0);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  const role = 'platform_owner' as const;
  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = fixtureOverrides?.actionCentreHref ?? getActionCentreRoute(actionRole);
  const notificationsHref = fixtureOverrides?.notificationsHref ?? getNotificationsRoute(actionRole);
  const companyName = fixtureOverrides?.companyName ?? 'XDrive Logistics';

  const navigationTargets = useMemo(
    () =>
      definition.nav.flatMap((group) =>
        group.items.map((item) => ({
          id: `${group.id}-${item.id}`,
          label: item.label,
          href: item.href,
        })),
      ),
    [definition.nav],
  );

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  useEffect(() => {
    if (typeof fixtureOverrides?.unreadCount === 'number') {
      setUnreadCount(fixtureOverrides.unreadCount);
      return;
    }
    if (!user?.id || !isSupabaseConfigured) return;

    let cancelled = false;
    const loadUnread = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .in('status', ['pending', 'failed']);
      if (!cancelled) setUnreadCount(count ?? 0);
    };

    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fixtureOverrides?.unreadCount, user?.id]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setAccountOpen(false);
  }, [pathname]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: workspaceTheme.page,
        color: workspaceTheme.text,
      }}
    >
      <div
        ref={navRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 80,
          background: '#fff',
          borderBottom: `1px solid ${workspaceTheme.border}`,
          boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
        }}
      >
        <header
          style={{
            minHeight: `${HEADER_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '0 18px',
            borderBottom: `1px solid ${workspaceTheme.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => router.push(definition.homeHref)}
            aria-label="Platform Owner home"
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              minWidth: 0,
              textAlign: 'left',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '5px',
                background: workspaceTheme.navy,
                color: workspaceTheme.orange,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 950,
                flexShrink: 0,
              }}
            >
              X
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  color: workspaceTheme.text,
                  fontSize: '13px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                XDrive Logistics
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: '1px',
                  color: workspaceTheme.muted,
                  fontSize: '10px',
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                }}
              >
                Global platform administration
              </span>
            </span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              minWidth: 0,
              flex: 1,
            }}
          >
            <div style={{ minWidth: 0, maxWidth: '620px', flex: '1 1 360px' }}>
              <SharedContextControls navigation={navigationTargets} />
            </div>

            <button
              type="button"
              onClick={() => router.push(actionCentreHref)}
              style={{
                height: '34px',
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: '6px',
                background: '#fff',
                color: workspaceTheme.text,
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 750,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Action Centre
            </button>

            <button
              type="button"
              onClick={() => router.push(notificationsHref)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              title="Notifications"
              style={{
                position: 'relative',
                width: '34px',
                height: '34px',
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    minWidth: '17px',
                    height: '17px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    background: workspaceTheme.red,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '9px',
                    fontWeight: 900,
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((value) => !value);
                  setOpenGroup(null);
                }}
                aria-expanded={accountOpen}
                style={{
                  height: '34px',
                  maxWidth: '190px',
                  border: `1px solid ${workspaceTheme.border}`,
                  borderRadius: '6px',
                  background: '#fff',
                  color: workspaceTheme.text,
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#eef2f6',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '10px',
                    fontWeight: 900,
                    color: workspaceTheme.navy,
                    flexShrink: 0,
                  }}
                >
                  PO
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {user?.email ?? companyName}
                </span>
                <span aria-hidden="true" style={{ fontSize: '9px' }}>▾</span>
              </button>

              {accountOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 7px)',
                    right: 0,
                    width: '210px',
                    padding: '7px',
                    border: `1px solid ${workspaceTheme.border}`,
                    borderRadius: '8px',
                    background: '#fff',
                    boxShadow: '0 14px 34px rgba(15,23,42,0.16)',
                  }}
                >
                  <div style={{ padding: '6px 8px 9px' }}>
                    <div style={{ fontSize: '10px', color: workspaceTheme.muted, fontWeight: 700 }}>
                      PLATFORM OWNER
                    </div>
                    <div
                      style={{
                        marginTop: '3px',
                        fontSize: '11px',
                        color: workspaceTheme.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {user?.email ?? ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(definition.homeHref)}
                    style={accountMenuButtonStyle}
                  >
                    Command Centre
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    style={{ ...accountMenuButtonStyle, color: workspaceTheme.red }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav
          aria-label="Platform Owner navigation"
          style={{
            minHeight: `${NAV_HEIGHT}px`,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'stretch',
            gap: '3px',
            overflowX: 'auto',
            overflowY: 'visible',
            scrollbarWidth: 'thin',
          }}
        >
          {definition.nav.map((group) => {
            const groupActive = group.items.some((item) => isActive(item.href));
            const open = openGroup === group.id;
            return (
              <div key={group.id} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenGroup((value) => (value === group.id ? null : group.id));
                    setAccountOpen(false);
                  }}
                  style={{
                    height: `${NAV_HEIGHT}px`,
                    border: 0,
                    borderBottom: groupActive
                      ? `3px solid ${workspaceTheme.blue}`
                      : '3px solid transparent',
                    background: open || groupActive ? '#f8fafc' : '#fff',
                    color: groupActive ? workspaceTheme.blue : workspaceTheme.text,
                    padding: '0 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: groupActive ? 800 : 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.label}
                  <span aria-hidden="true" style={{ fontSize: '8px', color: workspaceTheme.muted }}>▾</span>
                </button>

                {open && (
                  <div
                    role="menu"
                    aria-label={`${group.label} navigation`}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% - 1px)',
                      left: 0,
                      width: 'min(300px, 88vw)',
                      padding: '7px',
                      border: `1px solid ${workspaceTheme.border}`,
                      borderRadius: '0 0 8px 8px',
                      background: '#fff',
                      boxShadow: '0 16px 38px rgba(15,23,42,0.16)',
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 9px 8px',
                        color: workspaceTheme.muted,
                        fontSize: '9px',
                        fontWeight: 850,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            router.push(item.href);
                            setOpenGroup(null);
                          }}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            border: 0,
                            borderRadius: '5px',
                            background: active ? '#eff6ff' : '#fff',
                            color: active ? workspaceTheme.blue : workspaceTheme.text,
                            padding: '7px 9px',
                            display: 'grid',
                            gridTemplateColumns: '22px minmax(0,1fr)',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              display: 'grid',
                              placeItems: 'center',
                              background: active ? '#dbeafe' : '#eef2f6',
                              color: active ? workspaceTheme.blue : '#475569',
                              fontSize: '10px',
                              fontWeight: 900,
                            }}
                          >
                            {item.icon ?? '•'}
                          </span>
                          <span>
                            <span style={{ display: 'block', fontSize: '11px', fontWeight: 800 }}>
                              {item.label}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                marginTop: '2px',
                                color: workspaceTheme.muted,
                                fontSize: '9px',
                                fontWeight: 550,
                              }}
                            >
                              {navigationDescription(group.id, item.id)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}

const accountMenuButtonStyle = {
  width: '100%',
  minHeight: '34px',
  border: 0,
  borderRadius: '5px',
  background: '#fff',
  color: workspaceTheme.text,
  padding: '7px 8px',
  textAlign: 'left' as const,
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

function navigationDescription(groupId: string, itemId: string) {
  const descriptions: Record<string, string> = {
    'dashboard-command-centre': 'Live operational command and action queues',
    'dashboard-analytics': 'Cross-platform KPI and trend reporting',
    'dashboard-health': 'Service health and integration readiness',
    'dashboard-notifications': 'Platform notification delivery and failures',
    'marketplace-marketplace': 'Global marketplace workload',
    'marketplace-quotes': 'Commercial quotes across the platform',
    'marketplace-allocations': 'Award and allocation oversight',
    'marketplace-disputes': 'Marketplace dispute workflow',
    'operations-jobs': 'All transport jobs',
    'operations-active-jobs': 'Work currently in progress',
    'operations-pending-jobs': 'Work awaiting progression',
    'operations-completed-jobs': 'Delivered and completed workload',
    'operations-deliveries': 'Delivery execution overview',
    'operations-pods': 'Proof-of-delivery review queue',
    'fleet-drivers': 'Driver accounts and fleet membership',
    'fleet-driver-availability': 'Current driver readiness',
    'fleet-fleet-positions': 'Live operational fleet positions',
    'companies-companies': 'All registered platform companies',
    'companies-approvals': 'Applications awaiting platform approval',
    'companies-active': 'Approved active companies',
    'companies-suspended': 'Restricted company accounts',
    'companies-verification': 'Company identity verification',
    'companies-company-compliance': 'Company-level compliance status',
    'finance-finance-overview': 'Global financial position',
    'finance-invoices': 'Invoice workload and exceptions',
    'finance-fees': 'Fees and financial breakdown',
    'finance-revenue': 'Revenue reporting',
    'finance-payments': 'Payment status and receipts',
    'compliance-fraud-cases': 'Identity and fraud investigations',
    'compliance-insurance': 'Insurance review and expiry',
    'compliance-licences': 'Operator licence oversight',
    'compliance-expiries': 'Compliance expiry monitoring',
    'compliance-documents': 'Document review queue',
    'support-tickets': 'Platform support workload',
    'support-complaints': 'Complaint management',
    'support-support-disputes': 'Support-led dispute handling',
    'platform-global': 'Platform-wide configuration',
    'platform-roles': 'Access and permission governance',
    'platform-flags': 'Feature rollout controls',
    'platform-audit': 'Administrative audit trail',
    'platform-users': 'All platform users',
    'platform-admins': 'Privileged platform administrators',
  };
  return descriptions[`${groupId}-${itemId}`] ?? 'Open section';
}
