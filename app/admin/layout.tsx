import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-measured-cx-baseline.css';

// Protected workspace documents receive a per-request CSP nonce from middleware.
// Next.js can only apply that nonce to framework/page scripts when the route is
// rendered dynamically; static prerendering leaves hard reload/deep-link scripts
// without the request nonce and the browser blocks them under the strict CSP.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <AdminPlatformShell>{children}</AdminPlatformShell>
    </div>
  );
}
