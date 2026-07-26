// Minimal expo-network mock — online by default; tests can override.
export const NetworkStateType = { WIFI: 'WIFI', CELLULAR: 'CELLULAR', NONE: 'NONE' };

let _online = true;

export function __setOnline(value: boolean) { _online = value; }

export async function getNetworkStateAsync() {
  return { isConnected: _online, isInternetReachable: _online };
}

export function addNetworkStateListener(_cb: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) {
  return { remove: () => undefined };
}
