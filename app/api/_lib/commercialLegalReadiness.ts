import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildCurrentLegalRequirement,
  evaluateLegalAcceptance,
  type LegalAcceptanceSnapshot,
} from '../../../lib/legal/legalAgreementState';
import {
  LEGAL_LANGUAGES,
  type LegalLanguage,
} from '../../../lib/legal/controlledLegalDocuments';
import type { RegistrationLegalRole } from '../../../lib/legal/registrationAgreements';

type AdminClient = SupabaseClient;

type LegalAcceptanceRow = {
  registration_role: string;
  legal_version: string;
  agreements: unknown;
  acceptance_language: string | null;
  privacy_document_hash: string | null;
  accepted_at: string;
  created_at: string;
};

export type CommercialLegalReadiness = {
  ready: boolean;
  infrastructureAvailable: boolean;
  registrationRole: RegistrationLegalRole | null;
  currentLegalVersion: string | null;
  acceptedLegalVersion: string | null;
  reasons: string[];
};

const LEGAL_ROLES = new Set<RegistrationLegalRole>([
  'customer_shipper',
  'transport_broker',
  'owner_operator',
  'fleet_operator',
]);

const missingSchema = (error: { code?: string | null } | null | undefined) =>
  Boolean(error && ['PGRST205', '42P01', '42703'].includes(String(error.code ?? '')));

const normalizeAgreements = (value: unknown): LegalAcceptanceSnapshot['agreements'] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.code !== 'string' || typeof row.version !== 'string') return [];
    const language = typeof row.language === 'string' && LEGAL_LANGUAGES.includes(row.language as LegalLanguage)
      ? row.language as LegalLanguage
      : undefined;
    return [{
      code: row.code,
      version: row.version,
      language,
      translationVersion: typeof row.translationVersion === 'string' ? row.translationVersion : undefined,
      documentHash: typeof row.documentHash === 'string' ? row.documentHash : undefined,
    }];
  });
};

const toSnapshot = (row: LegalAcceptanceRow): LegalAcceptanceSnapshot => ({
  registrationRole: row.registration_role,
  legalVersion: row.legal_version,
  agreements: normalizeAgreements(row.agreements),
  acceptanceLanguage: row.acceptance_language && LEGAL_LANGUAGES.includes(row.acceptance_language as LegalLanguage)
    ? row.acceptance_language as LegalLanguage
    : undefined,
  privacyDocumentHash: row.privacy_document_hash,
});

async function loadCompanyLegalHistory(
  supabaseAdmin: AdminClient,
  companyId: string,
): Promise<{ rows: LegalAcceptanceRow[]; infrastructureAvailable: boolean }> {
  const select = 'registration_role, legal_version, agreements, acceptance_language, privacy_document_hash, accepted_at, created_at';

  const direct = await supabaseAdmin
    .from('registration_legal_acceptances')
    .select(select)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (direct.error) {
    if (missingSchema(direct.error)) return { rows: [], infrastructureAvailable: false };
    throw new Error(direct.error.message);
  }

  const rows = [...((direct.data ?? []) as unknown as LegalAcceptanceRow[])];
  if (rows.length > 0) return { rows, infrastructureAvailable: true };

  const onboarding = await supabaseAdmin
    .from('onboarding_applications')
    .select('id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (onboarding.error) {
    if (missingSchema(onboarding.error)) return { rows: [], infrastructureAvailable: false };
    throw new Error(onboarding.error.message);
  }

  const applicationIds = (onboarding.data ?? [])
    .map((row) => typeof row.id === 'string' ? row.id : null)
    .filter((id): id is string => Boolean(id));

  if (applicationIds.length === 0) return { rows: [], infrastructureAvailable: true };

  const linked = await supabaseAdmin
    .from('registration_legal_acceptances')
    .select(select)
    .in('onboarding_application_id', applicationIds)
    .order('created_at', { ascending: false })
    .limit(100);

  if (linked.error) {
    if (missingSchema(linked.error)) return { rows: [], infrastructureAvailable: false };
    throw new Error(linked.error.message);
  }

  return {
    rows: (linked.data ?? []) as unknown as LegalAcceptanceRow[],
    infrastructureAvailable: true,
  };
}

export async function getCommercialLegalReadiness(
  supabaseAdmin: AdminClient,
  companyId: string | null | undefined,
): Promise<CommercialLegalReadiness> {
  if (!companyId) {
    return {
      ready: false,
      infrastructureAvailable: true,
      registrationRole: null,
      currentLegalVersion: null,
      acceptedLegalVersion: null,
      reasons: ['commercial_company_required'],
    };
  }

  const history = await loadCompanyLegalHistory(supabaseAdmin, companyId);
  if (!history.infrastructureAvailable) {
    return {
      ready: false,
      infrastructureAvailable: false,
      registrationRole: null,
      currentLegalVersion: null,
      acceptedLegalVersion: null,
      reasons: ['legal_evidence_infrastructure_unavailable'],
    };
  }

  const supported = history.rows.filter((row) => LEGAL_ROLES.has(row.registration_role as RegistrationLegalRole));
  if (supported.length === 0) {
    return {
      ready: false,
      infrastructureAvailable: true,
      registrationRole: null,
      currentLegalVersion: null,
      acceptedLegalVersion: null,
      reasons: ['missing_company_legal_acceptance'],
    };
  }

  let latestEvaluation: { role: RegistrationLegalRole; currentVersion: string; acceptedVersion: string; reasons: string[] } | null = null;

  for (const row of supported) {
    const role = row.registration_role as RegistrationLegalRole;
    const language = row.acceptance_language && LEGAL_LANGUAGES.includes(row.acceptance_language as LegalLanguage)
      ? row.acceptance_language as LegalLanguage
      : 'en';
    const requirement = buildCurrentLegalRequirement(role, language);
    const evaluation = evaluateLegalAcceptance(requirement, toSnapshot(row));

    if (!evaluation.requiresReacceptance) {
      return {
        ready: true,
        infrastructureAvailable: true,
        registrationRole: role,
        currentLegalVersion: requirement.legalVersion,
        acceptedLegalVersion: row.legal_version,
        reasons: [],
      };
    }

    if (!latestEvaluation) {
      latestEvaluation = {
        role,
        currentVersion: requirement.legalVersion,
        acceptedVersion: row.legal_version,
        reasons: evaluation.reasons,
      };
    }
  }

  return {
    ready: false,
    infrastructureAvailable: true,
    registrationRole: latestEvaluation?.role ?? null,
    currentLegalVersion: latestEvaluation?.currentVersion ?? null,
    acceptedLegalVersion: latestEvaluation?.acceptedVersion ?? null,
    reasons: latestEvaluation?.reasons ?? ['current_legal_acceptance_missing'],
  };
}

export const COMMERCIAL_LEGAL_REACCEPTANCE_CODE = 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED';

export function commercialLegalReadinessPayload(
  message: string,
  readiness?: CommercialLegalReadiness,
  setupUrl?: string,
) {
  return {
    error: message,
    code: COMMERCIAL_LEGAL_REACCEPTANCE_CODE,
    ...(setupUrl ? { setupUrl } : {}),
    currentLegalVersion: readiness?.currentLegalVersion ?? null,
    acceptedLegalVersion: readiness?.acceptedLegalVersion ?? null,
    reasons: readiness?.reasons ?? [],
  };
}
