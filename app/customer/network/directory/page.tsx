'use client';

import { PageFrame, PageHeader } from '../../../components/workspace/WorkspaceUI';
import { MemberDirectoryPage } from '../../../components/workspace/MemberDirectoryPage';

export default function CustomerDirectoryPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="XDrive member network"
        title="Directory"
        description="Search XDrive companies and drivers independently of your own Companies relationship register."
      />
      <MemberDirectoryPage title="Directory" eyebrow="Customer member network" />
    </PageFrame>
  );
}
