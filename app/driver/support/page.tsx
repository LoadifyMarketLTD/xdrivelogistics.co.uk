'use client';

import WorkspaceSupportPage from '../../components/workspace/WorkspaceSupportPage';

export default function Page() {
  return <WorkspaceSupportPage settingsRoute="/driver/settings" eyebrow="Driver / Owner Driver" legalRoute="/driver/account/legal-agreements" notificationsRoute="/driver/notifications" />;
}
