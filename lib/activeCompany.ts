import { isSupabaseConfigured, supabase } from './supabaseClient';
import { resolveAuthContext } from './authContextResolver';

type ResolveActiveCompanyOptions = {
  userId: string;
  fallbackCompanyId?: string | null;
};

type RpcErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const inflightCompanyResolution = new Map<string, Promise<string | null>>();

const isMissingRpcError = (error: RpcErrorLike | null | undefined, rpcName: string) => {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  const normalizedRpcName = rpcName.toLowerCase();
  return (
    text.includes(`function public.${normalizedRpcName}`) ||
    text.includes(`function ${normalizedRpcName}`) ||
    text.includes(`${normalizedRpcName}()`)
  ) && (
    text.includes('schema cache') ||
    text.includes('could not find the function') ||
    text.includes('not found')
  );
};

const resolveCompanyIdFromRelations = async ({
  userId,
  fallbackCompanyId = null,
}: ResolveActiveCompanyOptions): Promise<string | null> => {
  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, is_driver, company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id, role_in_company')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id, company_type')
      .eq('created_by', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  const resolved = resolveAuthContext({
    membershipRole: (membershipRes.data as { role_in_company?: string | null } | null)?.role_in_company ?? null,
    profileRole: (profileRes.data as { role?: string | null } | null)?.role ?? null,
    isDriver:
      (profileRes.data as { is_driver?: boolean | null } | null)?.is_driver === true ||
      Boolean(driverRes.data),
    creatorCompanyType: (creatorCompanyRes.data as { company_type?: string | null } | null)?.company_type ?? null,
    fallbackRole: null,
    profileCompanyId: (profileRes.data as { company_id?: string | null } | null)?.company_id ?? null,
    membershipCompanyId: (membershipRes.data as { company_id?: string | null } | null)?.company_id ?? null,
    driverCompanyId: (driverRes.data as { company_id?: string | null } | null)?.company_id ?? null,
    creatorCompanyId: (creatorCompanyRes.data as { id?: string | null } | null)?.id ?? null,
    mustChangePassword: false,
  });

  return resolved.companyId ?? fallbackCompanyId ?? null;
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
    const { data: bootstrappedId, error: bootstrapError } = await supabase.rpc('bootstrap_company_membership');
    if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
      return bootstrappedId;
    }

    if (
      bootstrapError &&
      !isMissingRpcError(bootstrapError, 'bootstrap_company_membership') &&
      !isMissingRpcError(bootstrapError, 'get_or_create_company_for_user')
    ) {
      console.error('bootstrap_company_membership failed:', bootstrapError.message);
    }

    const resolvedFromRelations = await resolveCompanyIdFromRelations({
      userId,
      fallbackCompanyId,
    });
    if (resolvedFromRelations) return resolvedFromRelations;

    const { data: provisionedCompanyId, error: provisionError } = await supabase.rpc('get_or_create_company_for_user');
    if (typeof provisionedCompanyId === 'string' && provisionedCompanyId.length > 0) {
      return provisionedCompanyId;
    }
    if (provisionError && !isMissingRpcError(provisionError, 'get_or_create_company_for_user')) {
      console.error('get_or_create_company_for_user failed:', provisionError.message);
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
