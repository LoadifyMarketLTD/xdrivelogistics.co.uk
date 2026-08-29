import * as SecureStore from 'expo-secure-store';

const INSTALLATION_ID_KEY = 'xdrive.driver.installationId';
export const XDRIVE_DRIVER_PACKAGE = 'co.uk.xdrivelogistics.driver';

let cachedInstallationId: string | null = null;
let registeredToken: string | null = null;
let registrationInFlight: Promise<string> | null = null;

function randomHex(length: number) {
  let value = '';
  while (value.length < length) value += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return value.slice(0, length);
}

function createInstallationId() {
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)])}${randomHex(3)}-${randomHex(12)}`;
}

export async function getInstallationId(): Promise<string> {
  if (cachedInstallationId) return cachedInstallationId;

  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY).catch(() => null);
  if (stored) {
    cachedInstallationId = stored;
    return stored;
  }

  const installationId = createInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cachedInstallationId = installationId;
  return installationId;
}

export async function ensureDeviceSession(apiBaseUrl: string, token: string): Promise<string> {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error('Authenticated session is required.');

  const installationId = await getInstallationId();
  if (registeredToken === normalizedToken) return installationId;
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/driver/mobile/device-session`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
      },
      body: JSON.stringify({
        installation_id: installationId,
        app_package: XDRIVE_DRIVER_PACKAGE,
        device_label: 'XDrive Driver Expo',
      }),
    });

    const payload = await response.json().catch(() => ({} as { error?: string }));
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : `Device session registration failed with HTTP ${response.status}`);
    }

    registeredToken = normalizedToken;
    return installationId;
  })();

  try {
    return await registrationInFlight;
  } finally {
    registrationInFlight = null;
  }
}

export async function revokeDeviceSession(apiBaseUrl: string, token: string): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return;

  const installationId = await getInstallationId();
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/driver/mobile/device-session`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${normalizedToken}`,
      'x-xdrive-installation-id': installationId,
    },
  });

  if (!response.ok && response.status !== 401) {
    const payload = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Device session revocation failed with HTTP ${response.status}`);
  }

  clearDeviceSessionRegistrationCache();
}

export function clearDeviceSessionRegistrationCache() {
  registeredToken = null;
  registrationInFlight = null;
}
