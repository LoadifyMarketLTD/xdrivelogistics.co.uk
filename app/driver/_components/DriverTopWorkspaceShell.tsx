'use client';

import type { ReactNode } from 'react';
import Original3118WorkspaceShell from '../../components/workspace/Original3118WorkspaceShell';
import { useDriverAvailabilityPresencePublisher } from '../../hooks/useDriverAvailabilityPresencePublisher';

/** Driver and Owner Driver retain live presence, but use their own authorised 3118 navigation. */
export default function DriverTopWorkspaceShell({ children }: { children: ReactNode }) {
  useDriverAvailabilityPresencePublisher();
  return <Original3118WorkspaceShell forcedRole="owner_driver">{children}</Original3118WorkspaceShell>;
}
