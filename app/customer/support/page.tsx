'use client';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <WorkspaceSupportPage settingsRoute="/customer/settings" eyebrow="Customer / Shipper" legalRoute="/customer/account/legal-agreements" notificationsRoute="/customer/notifications" />;
}
