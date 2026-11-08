'use client';

import '@/app/admin/carrier-workspace-canonical.css';
import InvoiceCreateWorkflow from '@/app/components/workspace/InvoiceCreateWorkflow';

export default function BrokerNewInvoicePage() {
  return <div className="xdrive-carrier-workspace"><InvoiceCreateWorkflow workspace="broker" /></div>;
}
