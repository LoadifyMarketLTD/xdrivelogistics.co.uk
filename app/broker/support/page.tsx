import { Suspense } from 'react';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <Suspense fallback={<p>Loading support...</p>}><WorkspaceSupportPage settingsRoute="/broker/settings" eyebrow="Broker" legalRoute="/broker/account/legal-agreements" notificationsRoute="/broker/notifications" /></Suspense>;
}
