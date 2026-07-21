import type { SupabaseClient } from '@supabase/supabase-js';

import type { OnboardingAccountType } from '../../app/api/_lib/onboarding';

type ApplicationRow = {
  id: string;
  account_type: OnboardingAccountType;
  company_id: string | null;
  payload: Record<string, unknown> | null;
  status: string;
};

type ComplianceDocument = {
  docType: string;
  uploaded: boolean;
  verified: boolean;
  expired: boolean;
  expiryDate: string | null;
  status: string;
};

export type OnboardingComplianceReadiness = {
  application: ApplicationRow | null;
  requiredDocuments: string[];
  documents: ComplianceDocument[];
  missingDocuments: string[];
  unverifiedDocuments: string[];
  expiredDocuments: string[];
  uploadReady: boolean;
  approvalReady: boolean;
};

const readText = (payload: Record<string, unknown> | null | undefined, key: string) => {
  const value = payload?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readBoolean = (payload: Record<string, unknown> | null | undefined, key: string) => {
  const value = payload?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
};

const isExpired = (expiryDate: string | null | undefined) => {
  if (!expiryDate) return false;
  const expiry = new Date(`${expiryDate}T23:59:59.999Z`).getTime();
  return Number.isFinite(expiry) && expiry < Date.now();
};

export const requiredOnboardingDocuments = (
  accountType: OnboardingAccountType,
  payload: Record<string, unknown> | null | undefined,
): string[] => {
  if (accountType === 'customer_shipper') return [];

  if (accountType === 'broker_shipper') {
    const required = ['company_registration', 'public_liability'];
    if (readText(payload, 'vat_number')) required.push('vat_registration');
    return required;
  }

  if (accountType === 'fleet_courier') {
    const required = ['company_registration', 'public_liability', 'goods_in_transit', 'vehicle_insurance'];
    if (readText(payload, 'vat_number')) required.push('vat_registration');
    if (readBoolean(payload, 'operator_licence_required') || readText(payload, 'operator_licence_number')) {
      required.push('operator_licence');
    }
    return required;
  }

  const required = ['driving_licence', 'proof_of_address', 'insurance', 'right_to_work'];
  const rightToWorkStatus = readText(payload, 'right_to_work_status').toLowerCase();
  if (
    readText(payload, 'visa_type') ||
    readText(payload, 'visa_expiry') ||
    ['visa_required', 'share_code_required', 'pre_settled'].includes(rightToWorkStatus)
  ) {
    required.push('visa_document');
  }
  if (readBoolean(payload, 'cpc_required')) required.push('cpc');
  return required;
};

export async function getOnboardingComplianceReadiness(
  client: SupabaseClient,
  options: { applicationId?: string | null; companyId?: string | null },
): Promise<{ data: OnboardingComplianceReadiness | null; error: string | null }> {
  let query = client
    .from('onboarding_applications')
    .select('id, account_type, company_id, payload, status')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (options.applicationId) query = query.eq('id', options.applicationId);
  else if (options.companyId) query = query.eq('company_id', options.companyId);
  else return { data: null, error: 'An onboarding application or company id is required.' };

  const { data: applicationData, error: applicationError } = await query.maybeSingle();
  if (applicationError) return { data: null, error: applicationError.message };
  if (!applicationData) return { data: null, error: null };

  const application = applicationData as ApplicationRow;
  const requiredDocuments = requiredOnboardingDocuments(application.account_type, application.payload);
  if (requiredDocuments.length === 0) {
    return {
      data: {
        application,
        requiredDocuments,
        documents: [],
        missingDocuments: [],
        unverifiedDocuments: [],
        expiredDocuments: [],
        uploadReady: true,
        approvalReady: true,
      },
      error: null,
    };
  }

  const documents: ComplianceDocument[] = [];

  if (application.account_type === 'owner_driver') {
    const { data, error } = await client
      .from('driver_identity_documents')
      .select('doc_type, file_path, upload_status, verification_status, expiry_date, updated_at')
      .eq('onboarding_application_id', application.id)
      .in('doc_type', requiredDocuments)
      .order('updated_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    for (const row of data ?? []) {
      const expired = isExpired(row.expiry_date);
      documents.push({
        docType: String(row.doc_type),
        uploaded: Boolean(row.file_path) && row.upload_status === 'uploaded',
        verified: Boolean(row.file_path) && row.upload_status === 'uploaded' && row.verification_status === 'verified' && !expired,
        expired,
        expiryDate: row.expiry_date ?? null,
        status: expired ? 'expired' : String(row.verification_status ?? row.upload_status ?? 'missing'),
      });
    }
  } else {
    const { data, error } = await client
      .from('company_documents')
      .select('doc_type, file_path, status, expiry_date, updated_at')
      .eq('onboarding_application_id', application.id)
      .in('doc_type', requiredDocuments)
      .order('updated_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    for (const row of data ?? []) {
      const expired = isExpired(row.expiry_date) || row.status === 'expired';
      documents.push({
        docType: String(row.doc_type),
        uploaded: Boolean(row.file_path),
        verified: Boolean(row.file_path) && row.status === 'approved' && !expired,
        expired,
        expiryDate: row.expiry_date ?? null,
        status: expired ? 'expired' : String(row.status ?? 'pending'),
      });
    }
  }

  const byType = new Map<string, ComplianceDocument[]>();
  for (const document of documents) {
    const existing = byType.get(document.docType) ?? [];
    existing.push(document);
    byType.set(document.docType, existing);
  }

  const missingDocuments = requiredDocuments.filter((docType) =>
    !(byType.get(docType) ?? []).some((document) => document.uploaded));
  const unverifiedDocuments = requiredDocuments.filter((docType) =>
    !(byType.get(docType) ?? []).some((document) => document.verified));
  const expiredDocuments = requiredDocuments.filter((docType) =>
    (byType.get(docType) ?? []).some((document) => document.expired));

  return {
    data: {
      application,
      requiredDocuments,
      documents,
      missingDocuments,
      unverifiedDocuments,
      expiredDocuments,
      uploadReady: missingDocuments.length === 0,
      approvalReady: missingDocuments.length === 0 && unverifiedDocuments.length === 0 && expiredDocuments.length === 0,
    },
    error: null,
  };
}
