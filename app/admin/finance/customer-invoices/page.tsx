'use client';

import { WorkspaceFinanceControl } from '../../../components/workspace/WorkspaceFinanceControl';

export default function FinanceCustomerInvoicesPage() {
  return <WorkspaceFinanceControl role="carrier" initialView="receivable" />;
}
