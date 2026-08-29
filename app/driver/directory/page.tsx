'use client';

import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { MemberDirectoryPage } from '../../components/workspace/MemberDirectoryPage';

export default function DriverDirectoryPage() {
  return (
    <DriverWorkspaceShell
      personaLabel="Member network"
      driverName="Directory"
      subtitle="Search the authenticated XDrive member network without exposing private execution or personal data."
    >
      <MemberDirectoryPage title="Directory" eyebrow="Driver member network" />
    </DriverWorkspaceShell>
  );
}
