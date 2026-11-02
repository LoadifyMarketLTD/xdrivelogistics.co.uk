'use client';

import LoadPostingForm from '../../components/workspace/LoadPostingForm';
import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';

export default function BrokerPostLoadPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer load"
        title="Post Load"
        description="Create the customer transport request, keep quote-safe notes separate from private execution instructions, and publish it to carrier capacity."
      />
      <LoadPostingForm mode="broker" />
    </PageFrame>
  );
}
