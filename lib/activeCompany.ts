import { resolveAuthenticatedUser } from './authSession';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const ACTIVE_COMPANY_STORAGE_KEY = 'xdrive:active-company-id';

type ResolveActiveCompanyOptions = {
  userId: string;
  fallbackCompanyId?: string | null;
};

const inflightCompanyResolution = new Map<string, Promise<string | null>>();

export const setPreferredActiveCompanyId = (companyId: string | null) => {
  if (typeof window === 'undefined') return;
  if (!companyId) {
    window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId);
};

export const getPreferredActiveCompanyId = () => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const resolvePreferredCompanyId = ({
  membershipCompanyIds,
  preferredCompanyId,
  fallbackCompanyId,
}: {
  membershipCompanyIds: string[];
  preferredCompanyId?: string | null;
  fallbackCompanyId?: string | null;
}) => {
  const available = new Set(membershipCompanyIds.filter((value) => typeof value === 'string' && value.length > 0));
  if (preferredCompanyId && available.has(preferredCompanyId)) return preferredCompanyId;
  if (fallbackCompanyId && available.has(fallbackCompanyId)) return fallbackCompanyId;
  return membershipCompanyIds[0] ?? fallbackCompanyId ?? null;
};

export const resolveActiveCompanyId = async ({
  userId,
  fallbackCompanyId = null,
}: ResolveActiveCompanyOptions): Promise<string | null> => {
  if (!isSupabaseConfigured) return fallbackCompanyId;
  if (!userId) return fallbackCompanyId;

  const existingResolution = inflightCompanyResolution.get(userId);
  if (existingResolution) return existingResolution;

  const resolutionPromise = (async (): Promise<string | null> => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || authData.user?.id !== userId) {
      return fallbackCompanyId ?? null;
    }

    const preferredCompanyId = getPreferredActiveCompanyId();
    const membershipsRes = await supabase
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (!membershipsRes.error && membershipsRes.data) {
      const membershipCompanyIds = membershipsRes.data
        .map((row) => row.company_id)
        .filter((companyId): companyId is string => typeof companyId === 'string' && companyId.length > 0);
      const preferredResolved = resolvePreferredCompanyId({
        membershipCompanyIds,
        preferredCompanyId,
        fallbackCompanyId,
      });
      if (preferredResolved) return preferredResolved;
    }

    const resolvedAuth = await resolveAuthenticatedUser(authData.user);
    if (resolvedAuth.user) {
      return resolvedAuth.user.companyId ?? fallbackCompanyId ?? null;
    }

    return fallbackCompanyId ?? null;
  })();

  inflightCompanyResolution.set(userId, resolutionPromise);
  try {
    return await resolutionPromise;
  } finally {
    if (inflightCompanyResolution.get(userId) === resolutionPromise) {
      inflightCompanyResolution.delete(userId);
    }
  }
};
