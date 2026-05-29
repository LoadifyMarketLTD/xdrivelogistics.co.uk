import { resolveAuthenticatedUser } from './authSession';
import { isSupabaseConfigured, supabase } from './supabaseClient';

type ResolveActiveCompanyOptions = {
  userId: string;
  fallbackCompanyId?: string | null;
};

const inflightCompanyResolution = new Map<string, Promise<string | null>>();

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
