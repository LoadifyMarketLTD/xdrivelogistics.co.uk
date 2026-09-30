'use client';

import { useContext, useMemo, useState } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useAuth } from '../AuthContext';
import TopWorkspaceShell from './TopWorkspaceShell';
import RoleSettingsWorkspace from './RoleSettingsWorkspace';
import WorkspaceSupportPage from './WorkspaceSupportPage';
import LoadPostingForm from './LoadPostingForm';
import { MemberDirectoryPage } from './MemberDirectoryPage';
import LiveAvailabilityPage from '../../admin/live-availability/page';
import CarrierOperationsDashboardHome from './CarrierOperationsDashboardHome';
import BillingSettingsPage from '../../settings/billing/page';
import { PageHeader } from './WorkspaceUI';
import { resolveLegalRemediationUrl } from '../../../lib/workspaceRemediation';

const roots = { carrier: '/admin', customer: '/customer', broker: '/broker', owner: '/driver', driver: '/driver' } as const;
const forcedRoles = { carrier: 'company_owner', customer: 'customer', broker: 'broker', owner: 'owner_driver', driver: 'driver' } as const;
type Role = keyof typeof roots;
/** Dev-only harness: real components, mocked network supplied by Playwright.
 * Navigation is captured locally; no production action or legal acceptance runs.
 */
export default function WorkspaceRecoveryFixture({ role, initialScreen }: { role: Role; initialScreen: string }) {
  const actualRouter = useContext(AppRouterContext);
  const { user } = useAuth();
  const root = roots[role];
  const mode = role === 'carrier' ? 'admin' : role === 'driver' ? 'owner' : role;
  const [path, setPath] = useState(initialScreen === 'legacy-billing' ? '/settings/billing' : initialScreen === 'directory' ? '/admin/marketplace/directory' : `${root}/${initialScreen === 'billing' ? 'settings/billing' : initialScreen}`);
  const [lastTarget, setLastTarget] = useState('');
  const fixtureRouter = useMemo(() => actualRouter ? { ...actualRouter,
    push: (href: string) => { setLastTarget(href); setPath(href); },
    replace: (href: string) => { setLastTarget(href); setPath(href); },
    back: () => { setLastTarget(`${root}/settings`); setPath(`${root}/settings`); },
  } : null, [actualRouter, root]);
  const pathname = path.split('?')[0];
  const params = useMemo(() => new URLSearchParams(path.split('?')[1] ?? ''), [path]);
  if (!fixtureRouter) return null;
  const legalRoute = resolveLegalRemediationUrl('/admin/settings/legal-agreements', mode) ?? undefined;
  return (
    <AppRouterContext.Provider value={fixtureRouter}>
      <PathnameContext.Provider value={pathname}>
        <SearchParamsContext.Provider value={params}>
          <div className="xdrive-workspace-measured xdrive-operational-top-workspace" data-testid="workspace-recovery-fixture">
            <TopWorkspaceShell forcedRole={forcedRoles[role]}>
              <div role="note" style={{ padding: '4px 12px', fontSize: 11 }}>LOCAL TEST DATA - navigation capture only</div>
              <output data-testid="fixture-user" hidden>{user?.companyId ?? ''}</output>
              <output data-testid="navigation-target" hidden>{lastTarget}</output>
              {pathname === '/admin/dashboard' ? <CarrierOperationsDashboardHome />
                : pathname === '/admin/live-availability' ? <LiveAvailabilityPage />
                : pathname === '/admin/marketplace/directory' ? <MemberDirectoryPage title="Directory" eyebrow="Carrier member network" />
                : pathname === `${root}/settings` ? <RoleSettingsWorkspace role={role} />
                : (pathname === `${root}/settings/billing` || pathname === '/settings/billing') ? <BillingSettingsPage />
                : pathname === `${root}/support` ? <WorkspaceSupportPage eyebrow={role} settingsRoute={`${root}/settings`} legalRoute={legalRoute} notificationsRoute={`${root}/notifications`} />
                : pathname === `${root}/post-load` ? <><PageHeader title="Post Load" description="Local response-handling fixture; no transport work is created." /><LoadPostingForm mode={mode} /></>
                : <PageHeader title="Navigation destination captured" description={path} />}
            </TopWorkspaceShell>
          </div>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
