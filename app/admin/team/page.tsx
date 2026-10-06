'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  ActionButton,
  AlertBanner,
  PageFrame,
  PageHeader,
  Panel,
} from '../../components/workspace/WorkspaceUI';

export default function CompanyTeamRolesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const membershipRole = (user?.membershipRole ?? '').trim().toLowerCase();
  const canManageRoles = membershipRole === 'owner' || membershipRole === 'admin';

  return (
    <ProtectedRoute>
      <PageFrame>
        <PageHeader
          eyebrow="Company administration"
          title="Team & Roles"
          description="Assign operational company functions. Company Owners and Admins control who works as Fleet Manager or Dispatcher."
        />

        {!canManageRoles && (
          <AlertBanner tone="info">
            Your company membership can view this page, but only Company Owners and Admins can assign operational roles.
          </AlertBanner>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
          <Panel
            title="Fleet Manager"
            description="Manages fleet capacity, vehicles, drivers, assignments, positions, maintenance and operational readiness."
          >
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
                Assign this function to a company team member who is responsible for fleet operations. The membership is stored as <strong>fleet_manager</strong> and opens the Fleet Workspace.
              </div>
              <ActionButton tone="primary" disabled={!canManageRoles} onClick={() => router.push('/admin/fleet/managers')}>
                Add / Manage Fleet Managers
              </ActionButton>
            </div>
          </Panel>

          <Panel
            title="Dispatcher"
            description="Coordinates daily jobs, allocations, collections, deliveries, live positions and operational exceptions."
          >
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55 }}>
                Assign this function to a company team member who coordinates transport execution. The membership is stored as <strong>dispatcher</strong> and opens the Operations Workspace.
              </div>
              <ActionButton tone="primary" disabled={!canManageRoles} onClick={() => router.push('/admin/dispatchers')}>
                Add / Manage Dispatchers
              </ActionButton>
            </div>
          </Panel>
        </div>
      </PageFrame>
    </ProtectedRoute>
  );
}
