'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import LoadPostingForm from '../../components/workspace/LoadPostingForm';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

export default function OwnerDriverPostLoadPage() {
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        personaLabel="Owner driver workspace"
        subtitle="Create transport work from the owner-operator company account using the same production posting contract as Customer, Broker and Fleet."
      >
        <LoadPostingForm mode="owner" />
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
