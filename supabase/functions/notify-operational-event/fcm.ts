import { JWT } from 'npm:google-auth-library@11.0.2';

export interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FcmDeliveryResult {
  ok: boolean;
  providerMessageId?: string;
  unregistered?: boolean;
  error?: string;
}

export function parseFirebaseServiceAccount(raw: string): FirebaseServiceAccount | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FirebaseServiceAccount>;
    if (!parsed.project_id?.trim() || !parsed.client_email?.trim() || !parsed.private_key?.trim()) return null;
    return {
      project_id: parsed.project_id.trim(),
      client_email: parsed.client_email.trim(),
      private_key: parsed.private_key,
    };
  } catch {
    return null;
  }
}

async function getAccessToken(account: FirebaseServiceAccount): Promise<string> {
  const client = new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const credentials = await client.authorize();
  const token = credentials.access_token;
  if (!token) throw new Error('Firebase service account returned no access token.');
  return token;
}

export async function sendFcmMessage(args: {
  account: FirebaseServiceAccount;
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<FcmDeliveryResult> {
  try {
    const accessToken = await getAccessToken(args.account);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(args.account.project_id)}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: args.token,
            notification: { title: args.title, body: args.body },
            data: args.data,
            android: {
              priority: 'high',
              notification: {
                channel_id: 'xdrive_driver_assignments',
              },
            },
          },
        }),
      },
    );

    const raw = await response.text().catch(() => '');
    if (response.ok) {
      let providerMessageId: string | undefined;
      try {
        const parsed = JSON.parse(raw) as { name?: string };
        providerMessageId = parsed.name;
      } catch {
        providerMessageId = undefined;
      }
      return { ok: true, providerMessageId };
    }

    const normalized = raw.toUpperCase();
    const unregistered = response.status === 404 || normalized.includes('UNREGISTERED');
    return {
      ok: false,
      unregistered,
      error: `FCM ${response.status}: ${raw.slice(0, 500)}`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'FCM delivery failed.' };
  }
}
