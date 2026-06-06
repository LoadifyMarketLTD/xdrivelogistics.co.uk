'use client';

import PlatformModulePage from '../_components/PlatformModulePage';

export default function PlatformAuditLogPage() {
  return (
    <PlatformModulePage
      icon="📋"
      title="Audit Log"
      description="Immutable log of all governance actions, overrides and escalations."
      badge="Governance"
    />
  );
}
