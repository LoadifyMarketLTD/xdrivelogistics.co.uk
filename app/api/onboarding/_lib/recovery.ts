import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { getOnboardingContract } from '../../../../lib/onboardingContract';
import { assessOnboardingRecovery } from '../../../../lib/onboardingProgress';

const asPayload = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export async function assessStoredOnboardingRecovery({
  applicationId,
  accountType,
  companyId,
  payload: rawPayload,
}: {
  applicationId: string;
  accountType: string;
  companyId?: string | null;
  payload: unknown;
}) {
  const payload = asPayload(rawPayload);
  const contract = getOnboardingContract(accountType);

  if (!supabaseAdmin) {
    return {
      payload,
      recovery: assessOnboardingRecovery(accountType, payload, { companyId }),
      error: 'Server auth is not configured.',
    };
  }

  if (contract?.documents.length) {
    const identityTypes = contract.documents
      .filter((doc) => doc.family === 'identity')
      .map((doc) => doc.type);
    const companyTypes = contract.documents
      .filter((doc) => doc.family === 'company')
      .map((doc) => doc.type);

    if (identityTypes.length > 0) {
      const { data: identityDocs, error } = await supabaseAdmin
        .from('driver_identity_documents')
        .select('doc_type, file_path, upload_status')
        .eq('onboarding_application_id', applicationId)
        .in('doc_type', identityTypes);

      if (error) {
        return {
          payload,
          recovery: assessOnboardingRecovery(accountType, payload, { companyId }),
          error: error.message,
        };
      }

      for (const doc of identityDocs ?? []) {
        if (
          typeof doc.file_path === 'string'
          && doc.file_path.trim().length > 0
          && doc.upload_status === 'uploaded'
        ) {
          payload[`doc_${doc.doc_type}`] = doc.file_path;
        }
      }
    }

    if (companyTypes.length > 0) {
      const { data: companyDocs, error } = await supabaseAdmin
        .from('company_documents')
        .select('doc_type, file_path, status')
        .eq('onboarding_application_id', applicationId)
        .in('doc_type', companyTypes);

      if (error) {
        return {
          payload,
          recovery: assessOnboardingRecovery(accountType, payload, { companyId }),
          error: error.message,
        };
      }

      for (const doc of companyDocs ?? []) {
        if (
          typeof doc.file_path === 'string'
          && doc.file_path.trim().length > 0
          && doc.status !== 'rejected'
        ) {
          payload[`doc_${doc.doc_type}`] = doc.file_path;
        }
      }
    }
  }

  return {
    payload,
    recovery: assessOnboardingRecovery(accountType, payload, { companyId }),
    error: null,
  };
}
