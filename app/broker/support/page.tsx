'use client';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <WorkspaceSupportPage settingsRoute="/broker/settings" eyebrow="Broker" legalRoute="/broker/account/legal-agreements" notificationsRoute="/broker/notifications" />;
}
