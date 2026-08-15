import { resolveAuthenticatedUser } from './authSession';
import { isSupabaseConfigured, supabase } from './supabaseClient';

type ResolveActiveCompanyOptions = {
  userId: string;
  fallbackCompanyId?: string | null;
};

type ResolvedUserCompanyContext = {
  id?: string | null;
  companyId?: string | null;
} | null | undefined;

const inflightCompanyResolution = new Map<string, Promise<string | null>>();

export function resolveActiveCompanyId(user: ResolvedUserCompanyContext): string | null;
export function resolveActiveCompanyId(options: ResolveActiveCompanyOptions): Promise<string | null>;
export function resolveActiveCompanyId(
  input: ResolveActiveCompanyOptions | ResolvedUserCompanyContext,
): Promise<string | null> | string | null {
  if (!input) return null;

  if (!('userId' in input)) {
    return input.companyId ?? null;
  }

  const { userId, fallbackCompanyId = null } = input;
  if (!isSupabaseConfigured) return Promise.resolve(fallbackCompanyId);
  if (!userId) return Promise.resolve(fallbackCompanyId);

  const existingResolution = inflightCompanyResolution.get(userId);
  if (existingResolution) return existingResolution;

  const resolutionPromise = (async (): Promise<string | null> => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || authData.user?.id !== userId) {
      return fallbackCompanyId ?? null;
    }

    const resolvedAuth = await resolveAuthenticatedUser(authData.user);
    if (resolvedAuth.user) {
      return resolvedAuth.user.companyId ?? fallbackCompanyId ?? null;
    }

    return fallbackCompanyId ?? null;
  })();

  inflightCompanyResolution.set(userId, resolutionPromise);
  return resolutionPromise.finally(() => {
    if (inflightCompanyResolution.get(userId) === resolutionPromise) {
      inflightCompanyResolution.delete(userId);
    }
  });
}
