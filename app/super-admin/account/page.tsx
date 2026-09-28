'use client';

import { CircleUserRound } from 'lucide-react';
import { useAuth } from '@/app/components/AuthContext';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import {
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

export default function PlatformOwnerAccountPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminPage>
        <SuperAdminPageHeader
          eyebrow="Platform Owner"
          title="My account"
          description="Identity and access state from your authenticated XDrive session."
          icon={<CircleUserRound size={20} aria-hidden="true" />}
        />
        <SuperAdminSectionCard title="Signed-in identity" description="Read-only account details for the current session.">
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) minmax(0, 1fr)', gap: '14px 20px', margin: 0, overflowWrap: 'anywhere' }}>
            <dt>Email</dt><dd style={{ margin: 0 }}>{user?.email ?? 'Unavailable'}</dd>
            <dt>Workspace authority</dt><dd style={{ margin: 0 }}>Platform Owner</dd>
            <dt>Account status</dt><dd style={{ margin: 0 }}>{user?.accountStatus ?? 'Unavailable'}</dd>
            <dt>Application access</dt><dd style={{ margin: 0 }}>{user?.appAccess === null || user?.appAccess === undefined ? 'Unavailable' : user.appAccess ? 'Enabled' : 'Disabled'}</dd>
          </dl>
        </SuperAdminSectionCard>
      </SuperAdminPage>
    </ProtectedRoute>
  );
}
