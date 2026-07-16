import type { ReactNode } from 'react';
import { WorkspacePlatformShell } from '../components/workspace';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="authenticated-workspace">
      <WorkspacePlatformShell area="admin">{children}</WorkspacePlatformShell>
    </div>
  );
}
