'use client';

import DriverNotificationRegister from '../_components/DriverNotificationRegister';

export default function DriverMessagesPage() {
  return (
    <DriverNotificationRegister
      title="Messages"
      subtitle="Operational notifications from dispatch, workflow triggers and company updates. Personal read-state is not claimed because the current schema does not store it."
    />
  );
}
