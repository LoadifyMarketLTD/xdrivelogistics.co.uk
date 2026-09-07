'use client';

import { useRouter } from 'next/navigation';
import FinanceControlDashboardHome from '../../components/workspace/FinanceControlDashboardHome';
import { ActionButton } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function FinanceWorkspacePage() {
  const router = useRouter();
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '8px 12px 0', flexWrap: 'wrap' }}>
        <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/statements')}>Statements</ActionButton>
        <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/reports')}>Reports & Exports</ActionButton>
      </div>
      <WorkspaceFinanceControl role="carrier" />
      <FinanceControlDashboardHome />
    </>
  );
}
