'use client';

import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';
import { MemberDirectoryPage } from '../../components/workspace/MemberDirectoryPage';

export default function CarrierDirectoryPage() {
  return (
    <PageFrame>
      <PageHeader eyebrow="XDrive member network" title="Directory" description="Search XDrive companies and drivers without mixing the member network with carrier execution records." />
      <MemberDirectoryPage title="Directory" eyebrow="Carrier member network" />
    </PageFrame>
  );
}
