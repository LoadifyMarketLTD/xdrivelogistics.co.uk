import { Suspense } from 'react';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <Suspense fallback={<p>Loading support...</p>}><WorkspaceSupportPage settingsRoute="/customer/settings" eyebrow="Customer / Shipper" legalRoute="/customer/account/legal-agreements" notificationsRoute="/customer/notifications" /></Suspense>;
}
