'use client';

import InvoiceRegisterPage from '../../components/workspace/InvoiceRegisterPage';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function Page() {
  return <>
    <WorkspaceFinanceControl role="customer" />
    <InvoiceRegisterPage mode="customer" />
  </>;
}
