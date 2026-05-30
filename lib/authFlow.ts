export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || 'https://www.xdrivelogistics.co.uk';
export const LOGIN_PATH = '/login';
export const REGISTER_PATH = '/register';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const RESET_PASSWORD_PATH = '/reset-password';
export const LOGIN_RESET_SUCCESS_PATH = '/login?reset=success';

export type AuthLocationSignals = {
  pathname: string;
  search: string;
  hash: string;
  queryType: string | null;
  hashType: string | null;
  flow: string | null;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHashSessionTokens: boolean;
};

const readSearchParams = (value: string) => new URLSearchParams(value);
const normalizeHash = (hash: string) => hash.replace(/^#/, '');

export const getBrowserAuthSignals = (
  locationLike?: Pick<Location, 'pathname' | 'search' | 'hash'>
): AuthLocationSignals | null => {
  if (!locationLike && typeof window === 'undefined') {
    return null;
  }

  const target = locationLike ?? window.location;
  const queryParams = readSearchParams(target.search);
  const hashParams = readSearchParams(normalizeHash(target.hash));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  return {
    pathname: target.pathname,
    search: target.search,
    hash: target.hash,
    queryType: queryParams.get('type'),
    hashType: hashParams.get('type'),
    flow: queryParams.get('flow'),
    code: queryParams.get('code'),
    tokenHash: queryParams.get('token_hash'),
    accessToken,
    refreshToken,
    hasHashSessionTokens: Boolean(accessToken && refreshToken),
  };
};

export const buildPathWithAuthParams = (pathname: string, signals: Pick<AuthLocationSignals, 'search' | 'hash'>) =>
  `${pathname}${signals.search}${signals.hash}`;

export const isRecoveryAuthFlow = (signals: Pick<AuthLocationSignals, 'queryType' | 'hashType' | 'flow'>) =>
  signals.queryType === 'recovery' || signals.hashType === 'recovery' || signals.flow === 'recovery';

export const isInviteAuthFlow = (signals: Pick<AuthLocationSignals, 'queryType' | 'hashType' | 'flow'>) =>
  signals.queryType === 'invite' || signals.hashType === 'invite' || signals.flow === 'invite';

export const getAuthCallbackEmailRedirectTo = () => `${PUBLIC_SITE_URL}${AUTH_CALLBACK_PATH}`;
export const getResetPasswordEmailRedirectTo = () => `${PUBLIC_SITE_URL}${RESET_PASSWORD_PATH}`;
