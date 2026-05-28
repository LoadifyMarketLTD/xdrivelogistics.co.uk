import { isSupabaseConfigured, supabase } from './supabaseClient';

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
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id')
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
      .select('id')
      .eq('created_by', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    (profileRes.data?.company_id as string | null | undefined) ??
    (membershipRes.data?.company_id as string | null | undefined) ??
    (driverRes.data?.company_id as string | null | undefined) ??
    (creatorCompanyRes.data?.id as string | null | undefined) ??
    fallbackCompanyId
  ) ?? null;
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
