'use client';

import LoadPostingForm from '../../components/workspace/LoadPostingForm';
import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';

export default function AdminPostLoadPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet / carrier load"
        title="Post Load"
        description="Create a full transport request with customer, route, cargo, handling, documents and quote visibility in the live XDrive workflow."
      />
      <LoadPostingForm mode="admin" />
    </PageFrame>
  );
}
