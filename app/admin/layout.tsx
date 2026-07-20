import type { ReactNode } from 'react';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
