'use client';

import { useRouter } from 'next/navigation';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { useAuth } from '../AuthContext';
import { resolveAdminDashboard } from './RoleDashboards';
import { ActionButton, PermissionDeniedState } from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import CarrierOperationsDashboardHome from './CarrierOperationsDashboardHome';
import FleetControlDashboardHome from './FleetControlDashboardHome';
import DispatcherControlDashboardHome from './DispatcherControlDashboardHome';
import FinanceControlDashboardHome from './FinanceControlDashboardHome';
import ComplianceControlDashboardHome from './ComplianceControlDashboardHome';
import ViewerDashboardHome from './ViewerDashboardHome';

function BlockedAdminDashboardHome({ reason, homeHref }: { reason: string; homeHref: string | null }) {
  const router = useRouter();
  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Workspace boundary"
        title="Admin dashboard unavailable"
        badge="Access boundary"
        description="This role cannot inherit another role's dashboard, actions or data surface."
      />
      <PermissionDeniedState
        reason={reason}
        action={homeHref ? <ActionButton tone="secondary" onClick={() => router.push(homeHref)}>Open approved home route</ActionButton> : undefined}
      />
    </div>
  );
}

export { default as FleetControlDashboardHome } from './FleetControlDashboardHome';
export { default as CarrierOperationsDashboardHome } from './CarrierOperationsDashboardHome';
export { default as DispatcherControlDashboardHome } from './DispatcherControlDashboardHome';
export { default as FinanceControlDashboardHome } from './FinanceControlDashboardHome';
export { default as ComplianceControlDashboardHome } from './ComplianceControlDashboardHome';
export { default as ViewerDashboardHome } from './ViewerDashboardHome';

export default function AdminRoleDashboardHome() {
  const { user } = useAuth();
  const resolution = resolveAdminDashboard(user?.workspaceRole ?? resolveWorkspaceRole(user));

  switch (resolution.target) {
    case 'carrier':
      return <CarrierOperationsDashboardHome />;
    case 'fleet':
      return <FleetControlDashboardHome />;
    case 'dispatcher':
      return <DispatcherControlDashboardHome />;
    case 'finance':
      return <FinanceControlDashboardHome />;
    case 'compliance':
      return <ComplianceControlDashboardHome />;
    case 'viewer':
      return <ViewerDashboardHome />;
    case 'blocked':
      return (
        <BlockedAdminDashboardHome
          reason={resolution.blocker ?? 'Admin dashboard unavailable.'}
          homeHref={resolution.homeHref}
        />
      );
  }
}
