'use client';

import { useCallback, useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '../_components/SuperAdminLiveTablePage';
import {
  createNotificationColumns,
  notificationsTableProps,
  performNotificationRetry,
  type NotificationRow,
  type RetryFeedback,
} from './_lib/notificationsPage';

export default function Page() {
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, RetryFeedback | undefined>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRetry = useCallback(async (notificationId: string) => {
    if (pendingById[notificationId]) return;

    setPendingById((current) => ({ ...current, [notificationId]: true }));
    setFeedbackById((current) => ({ ...current, [notificationId]: undefined }));

    const feedback = await performNotificationRetry({
      notificationId,
      onSuccess: () => {
        setRefreshKey((value) => value + 1);
      },
    });

    setPendingById((current) => {
      const next = { ...current };
      delete next[notificationId];
      return next;
    });
    setFeedbackById((current) => ({ ...current, [notificationId]: feedback }));
  }, [pendingById]);

  const columns = useMemo(
    () => createNotificationColumns({ pendingById, feedbackById, onRetry: handleRetry }),
    [pendingById, feedbackById, handleRetry],
  );

  return (
    <SuperAdminLiveTablePage<NotificationRow>
      {...notificationsTableProps}
      refreshKey={refreshKey}
      columns={columns}
    />
  );
}
