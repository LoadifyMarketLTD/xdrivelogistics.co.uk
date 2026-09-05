import * as Notifications from 'expo-notifications';

let foregroundHandlerConfigured = false;
const handledResponses = new Set<string>();

function configureForegroundHandler() {
  if (foregroundHandlerConfigured) return;
  foregroundHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function jobIdFromResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data ?? {};
  const direct = stringValue(data.job_id);
  if (direct) return direct;

  const deepLink = stringValue(data.deep_link);
  const match = /^xdrive:\/\/job\/([^/?#]+)/i.exec(deepLink);
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function responseIdentity(response: Notifications.NotificationResponse) {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

function handleResponse(response: Notifications.NotificationResponse | null, onOpenJob: (jobId: string) => void) {
  if (!response) return;
  const identity = responseIdentity(response);
  if (handledResponses.has(identity)) return;

  const jobId = jobIdFromResponse(response);
  if (!jobId) return;

  handledResponses.add(identity);
  onOpenJob(jobId);
}

/**
 * Keeps notification presentation and navigation in the Expo client tied to
 * the same job_id/deep_link contract emitted by XDrive's trusted FCM worker.
 */
export function subscribeToNotificationNavigation(onOpenJob: (jobId: string) => void) {
  configureForegroundHandler();

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => handleResponse(response, onOpenJob))
    .catch(() => undefined);

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response, onOpenJob);
  });

  return () => subscription.remove();
}
