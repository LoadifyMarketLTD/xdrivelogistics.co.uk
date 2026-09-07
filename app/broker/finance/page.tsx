'use client';

import { useRouter } from 'next/navigation';
import {
  ActionButton,
  PageFrame,
  PageHeader,
  Panel,
} from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

const compactCopy: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 11,
  lineHeight: '16px',
};

export default function BrokerFinancePage() {
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker finance"
        title="Finance"
        description="Customer revenue, carrier costs and margin control in one operational finance entry point."
      />

      <WorkspaceFinanceControl role="broker" />

      <div style={{ display: 'grid', gap: 5 }}>
        <Panel
          title="Customer invoices"
          description="Issued revenue invoices, payment state, due dates and overdue customer balances."
          actions={<ActionButton tone="primary" onClick={() => router.push('/broker/customer-invoices')}>Open invoices</ActionButton>}
        >
          <p style={compactCopy}>Use the existing customer invoice ledger for invoice-level actions and payment follow-up.</p>
        </Panel>

        <Panel
          title="Carrier costs"
          description="Supplier/carrier payables and the cost side of subcontracted transport."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/carrier-costs')}>Open carrier costs</ActionButton>}
        >
          <p style={compactCopy}>Review the existing carrier cost ledger before approving or reconciling supplier charges.</p>
        </Panel>

        <Panel
          title="Margin & profit"
          description="Compare customer revenue with awarded carrier cost and protect commercial margin."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/margins')}>Open margins</ActionButton>}
        >
          <p style={compactCopy}>Margin reporting remains connected to the existing broker finance calculations and job/invoice data.</p>
        </Panel>
      </div>
    </PageFrame>
  );
}
