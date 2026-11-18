import type { SupabaseClient } from '@supabase/supabase-js';

export type CompanyRegistrationAccountType = 'broker_shipper' | 'fleet_courier';

type CompaniesHouseCompany = {
  company_name?: unknown;
  company_number?: unknown;
  company_status?: unknown;
};

type AtomicRegistrationRow = {
  success: boolean;
  http_status: number;
  error_code: string | null;
  error_message: string | null;
  company_id: string | null;
  created: boolean;
};

export type VerifiedCompanyRegistrationResult =
  | {
      success: true;
      companyId: string;
      created: boolean;
      companyNumber: string;
      registeredName: string;
      registryStatus: 'active';
    }
  | {
      success: false;
      httpStatus: number;
      errorCode: string;
      error: string;
    };

export function normalizeCompanyNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function failure(httpStatus: number, errorCode: string, error: string): VerifiedCompanyRegistrationResult {
  return { success: false, httpStatus, errorCode, error };
}

export async function registerCompaniesHouseCompany(options: {
  supabase: SupabaseClient;
  actorUserId: string;
  companyNumber: string;
  accountType: CompanyRegistrationAccountType;
}): Promise<VerifiedCompanyRegistrationResult> {
  const { supabase, actorUserId, accountType } = options;
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

  if (!apiKey) {
    console.error('[company-registration] COMPANIES_HOUSE_API_KEY is not configured.');
    return failure(503, 'REGISTRY_NOT_CONFIGURED', 'Company verification is temporarily unavailable.');
  }

  const requestedCompanyNumber = normalizeCompanyNumber(options.companyNumber);
  if (!/^[A-Z0-9]{6,16}$/.test(requestedCompanyNumber)) {
    return failure(400, 'INVALID_COMPANY_NUMBER', 'Enter a valid Companies House number.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    const authorization = Buffer.from(`${apiKey}:`).toString('base64');
    response = await fetch(
      `https://api.company-information.service.gov.uk/company/${encodeURIComponent(requestedCompanyNumber)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${authorization}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[company-registration] Companies House request failed:', message);
    return failure(502, 'REGISTRY_UNAVAILABLE', 'Companies House could not be reached. Try again shortly.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    return failure(404, 'COMPANY_NOT_FOUND', 'The company number was not found at Companies House.');
  }

  if (response.status === 429) {
    return failure(503, 'REGISTRY_RATE_LIMITED', 'Company verification is busy. Try again shortly.');
  }

  if (!response.ok) {
    console.error('[company-registration] Companies House rejected request:', response.status);
    return failure(502, 'REGISTRY_UNAVAILABLE', 'Companies House verification is temporarily unavailable.');
  }

  let registryCompany: CompaniesHouseCompany;
  try {
    registryCompany = (await response.json()) as CompaniesHouseCompany;
  } catch {
    return failure(502, 'INVALID_REGISTRY_RESPONSE', 'Companies House returned an invalid response.');
  }

  const registryCompanyNumber = typeof registryCompany.company_number === 'string'
    ? normalizeCompanyNumber(registryCompany.company_number)
    : '';
  const registeredName = typeof registryCompany.company_name === 'string'
    ? registryCompany.company_name.trim()
    : '';
  const registryStatus = typeof registryCompany.company_status === 'string'
    ? registryCompany.company_status.trim().toLowerCase()
    : '';

  if (registryCompanyNumber !== requestedCompanyNumber || !registeredName) {
    return failure(502, 'REGISTRY_IDENTITY_MISMATCH', 'Companies House returned a different company identity.');
  }

  if (registryStatus !== 'active') {
    return failure(
      409,
      'COMPANY_NOT_ACTIVE',
      `This Companies House record is '${registryStatus || 'unknown'}'. Only active companies can register.`,
    );
  }

  const { data, error } = await supabase.rpc('register_validated_company_atomic', {
    p_actor_user_id: actorUserId,
    p_company_number: registryCompanyNumber,
    p_company_name: registeredName,
    p_registry_status: registryStatus,
    p_account_type: accountType,
  });

  if (error) {
    console.error('[company-registration] Atomic registration RPC failed:', error.message);
    return failure(500, 'REGISTRATION_RPC_FAILED', 'The verified company could not be registered.');
  }

  const row = (Array.isArray(data) ? data[0] : data) as AtomicRegistrationRow | null;
  if (!row?.success || !row.company_id) {
    return failure(
      Number(row?.http_status ?? 409),
      row?.error_code ?? 'COMPANY_REGISTRATION_FAILED',
      row?.error_message ?? 'The verified company could not be registered.',
    );
  }

  return {
    success: true,
    companyId: row.company_id,
    created: Boolean(row.created),
    companyNumber: registryCompanyNumber,
    registeredName,
    registryStatus: 'active',
  };
}
