'use client';

import { useRouter } from 'next/navigation';
import {
  ActionButton,
  PageFrame,
  PageHeader,
  Panel,
} from '../../components/workspace/WorkspaceUI';

const compactCopy: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 11,
  lineHeight: '16px',
};

export default function BrokerAccountPage() {
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker administration"
        title="Account"
        description="Company settings and team administration grouped under one account entry point."
      />

      <div style={{ display: 'grid', gap: 5 }}>
        <Panel
          title="Company settings"
          description="Manage the broker company profile and workspace configuration."
          actions={<ActionButton tone="primary" onClick={() => router.push('/broker/settings')}>Open settings</ActionButton>}
        >
          <p style={compactCopy}>The existing Settings module remains the source of truth for company configuration.</p>
        </Panel>

        <Panel
          title="Team"
          description="Review broker users and the existing team administration surface."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/team')}>Open team</ActionButton>}
        >
          <p style={compactCopy}>Team administration stays connected to the existing company membership workflow.</p>
        </Panel>
      </div>
    </PageFrame>
  );
}
