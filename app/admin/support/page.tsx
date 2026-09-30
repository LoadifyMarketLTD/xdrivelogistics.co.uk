'use client';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <WorkspaceSupportPage settingsRoute="/admin/settings" eyebrow="Carrier / Company" legalRoute="/admin/settings/legal-agreements" notificationsRoute="/admin/notifications" />;
}
