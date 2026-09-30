import { Suspense } from 'react';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <Suspense fallback={<p>Loading support...</p>}><WorkspaceSupportPage settingsRoute="/driver/settings" eyebrow="Driver / Owner Driver" legalRoute="/driver/account/legal-agreements" notificationsRoute="/driver/notifications" /></Suspense>;
}
