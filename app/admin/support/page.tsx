import { Suspense } from 'react';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <Suspense fallback={<p>Loading support...</p>}><WorkspaceSupportPage settingsRoute="/admin/settings" eyebrow="Carrier / Company" legalRoute="/admin/settings/legal-agreements" notificationsRoute="/admin/notifications" /></Suspense>;
}
