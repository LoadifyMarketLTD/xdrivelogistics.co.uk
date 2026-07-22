'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface RegistrationResult {
  success: boolean;
  error?: string;
  companyId?: string;
  created?: boolean;
}

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

function normaliseCompanyNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Validates an active UK company through Companies House and atomically links it
 * to the authenticated account. The actor is derived from a verified Supabase
 * access token; callers cannot select a user id.
 */
export async function registerValidatedCompany(
  companyNumber: string,
  sessionAccessToken: string
): Promise<RegistrationResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      console.error('Company registration server configuration is incomplete.');
      return { success: false, error: 'Configurație server invalidă. Contactați asistența.' };
    }

    const accessToken = sessionAccessToken?.trim();
    if (!accessToken) {
      return { success: false, error: 'Sesiunea de autentificare lipsește sau a expirat.' };
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return { success: false, error: 'Sesiunea de autentificare nu este validă.' };
    }

    const canonicalCompanyNumber = normaliseCompanyNumber(companyNumber);
    if (!canonicalCompanyNumber || canonicalCompanyNumber.length > 32) {
      return { success: false, error: 'Numărul companiei este invalid.' };
    }

    const authHeader = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch(
      `https://api.company-information.service.gov.uk/company/${encodeURIComponent(canonicalCompanyNumber)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return { success: false, error: 'Numărul introdus nu a fost găsit în registrul oficial Companies House.' };
    }

    const companyData = (await response.json()) as CompaniesHouseCompany;
    const registryStatus = typeof companyData.company_status === 'string'
      ? companyData.company_status.trim().toLowerCase()
      : '';
    const registeredName = typeof companyData.company_name === 'string'
      ? companyData.company_name.trim()
      : '';
    const registryCompanyNumber = typeof companyData.company_number === 'string'
      ? normaliseCompanyNumber(companyData.company_number)
      : canonicalCompanyNumber;

    if (registryStatus !== 'active') {
      return {
        success: false,
        error: `Înregistrare respinsă. Această companie are statusul guvernamental '${registryStatus || 'necunoscut'}'. Permitem accesul doar firmelor active.`,
      };
    }

    if (!registeredName || registryCompanyNumber !== canonicalCompanyNumber) {
      return { success: false, error: 'Răspunsul Companies House nu corespunde numărului de companie solicitat.' };
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc('register_validated_company_atomic', {
      p_actor_user_id: authData.user.id,
      p_company_number: registryCompanyNumber,
      p_company_name: registeredName,
      p_registry_status: registryStatus,
    });

    if (rpcError) {
      console.error('Atomic company registration failed:', rpcError.message);
      return { success: false, error: 'Compania nu a putut fi înregistrată.' };
    }

    const result = (Array.isArray(data) ? data[0] : data) as AtomicRegistrationRow | null;
    if (!result?.success || !result.company_id) {
      return {
        success: false,
        error: result?.error_message || 'Compania nu a putut fi înregistrată.',
      };
    }

    revalidatePath('/super-admin/companies/approvals');

    return {
      success: true,
      companyId: result.company_id,
      created: result.created,
    };
  } catch (error) {
    console.error('Unexpected company registration failure:', error);
    return { success: false, error: 'Eroare critică de sistem la procesarea înregistrării.' };
  }
}
