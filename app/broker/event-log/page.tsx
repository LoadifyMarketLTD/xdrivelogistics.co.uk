'use client';

import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';

export default function BrokerEventLogPage() {
  return (
    <WorkspaceEventLogPage
      eyebrow="Broker operational audit"
      description="Search and export operational events delivered to your broker account."
    />
  );
}
