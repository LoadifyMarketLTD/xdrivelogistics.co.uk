'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';

/** Keep authenticated Broker's existing shell and permissions on every subroute.
 * The approved 3150 demo has its own fixed sidebar and is used only for /broker.
 */
export default function Broker3150LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/broker') return <>{children}</>;
  return <TopWorkspaceShell forcedRole="broker">{children}</TopWorkspaceShell>;
}
