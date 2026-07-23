'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import {
  registerCompaniesHouseCompany,
  type CompanyRegistrationAccountType,
} from '../../lib/server/companyRegistration';

interface RegistrationResult {
  success: boolean;
  error?: string;
  companyId?: string;
  created?: boolean;
}

/**
 * Verifies the caller's Supabase access token, resolves the account type from
 * the caller's onboarding application, validates the company against Companies
 * House and registers it through the service-role-only atomic RPC.
 */
export async function registerValidatedCompany(
  companyNumber: string,
  sessionAccessToken: string,
): Promise<RegistrationResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[company-registration] Supabase server configuration is incomplete.');
      return { success: false, error: 'Company registration is temporarily unavailable.' };
    }

    const accessToken = sessionAccessToken?.trim();
    if (!accessToken) {
      return { success: false, error: 'Your session is missing or has expired.' };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return { success: false, error: 'Your session is not valid.' };
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('account_type')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (applicationError) {
      console.error('[company-registration] Failed to resolve onboarding account type:', applicationError.message);
      return { success: false, error: 'Your onboarding application could not be loaded.' };
    }

    if (!application || !['broker_shipper', 'fleet_courier'].includes(application.account_type)) {
      return { success: false, error: 'Companies House registration is only available for broker and fleet company accounts.' };
    }

    const result = await registerCompaniesHouseCompany({
      supabase: supabaseAdmin,
      actorUserId: authData.user.id,
      companyNumber,
      accountType: application.account_type as CompanyRegistrationAccountType,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/super-admin/companies/approvals');
    revalidatePath('/onboarding/resume');

    return {
      success: true,
      companyId: result.companyId,
      created: result.created,
    };
  } catch (error) {
    console.error('[company-registration] Unexpected registration failure:', error);
    return { success: false, error: 'A system error prevented company registration.' };
  }
}
