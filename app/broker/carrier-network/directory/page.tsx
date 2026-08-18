'use client';

import { PageFrame, PageHeader } from '../../../components/workspace/WorkspaceUI';
import { MemberDirectoryPage } from '../../../components/workspace/MemberDirectoryPage';

export default function BrokerDirectoryPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="XDrive member network"
        title="Directory"
        description="Search XDrive member companies and drivers independently of broker customer and carrier relationship registers."
      />
      <MemberDirectoryPage title="Directory" eyebrow="Broker member network" />
    </PageFrame>
  );
}
