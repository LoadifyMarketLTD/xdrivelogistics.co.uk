// QA-only network firewall. This module is inert in public production builds.
export type QaNetworkPolicy = {
  origin: string;
  qaMode: boolean;
  allowAuthLogin: boolean;
  allowSyntheticLocalWrites: boolean;
};

const AUTH_ORIGIN = 'https://jqxlauexhkonixtjvljw.supabase.co';
const SYNTHETIC_JOB_ID = '22222222-3333-4444-8555-666666666666';

export function qaWriteAllowed(method: string, target: string, policy: QaNetworkPolicy): boolean {
  if (!policy.qaMode) return true;
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return true;
  let url: URL;
  let origin: URL;
  try {
    origin = new URL(policy.origin);
    url = new URL(target, origin);
  } catch {
    return false;
  }
  // Authentication is needed for READ-ONLY role verification. No business writes.
  if (policy.allowAuthLogin && verb === 'POST' && url.origin === AUTH_ORIGIN) {
    const grant = url.searchParams.get('grant_type');
    if (url.pathname === '/auth/v1/token' && (grant === 'password' || grant === 'refresh_token')) return true;
    if (url.pathname === '/auth/v1/logout') return true;
  }
  // Explicitly enabled only by the separate synthetic Vite QA server (no upstream proxy).
  const fixturePath = '/xdrive-api/driver/mobile/jobs/' + SYNTHETIC_JOB_ID;
  return policy.allowSyntheticLocalWrites && verb === 'POST'
    && origin.hostname === '127.0.0.1' && origin.port === '5220'
    && url.origin === origin.origin
    && (url.pathname === fixturePath + '/status' || url.pathname === fixturePath + '/undo-status');
}

export function installQaNetworkGuard(policy: QaNetworkPolicy): void {
  if (!policy.qaMode) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    if (!qaWriteAllowed(method, url, policy)) {
      return Promise.reject(new Error('QA isolation: changing real bookings, files or invoices is blocked.'));
    }
    return originalFetch(input, init);
  };
}
