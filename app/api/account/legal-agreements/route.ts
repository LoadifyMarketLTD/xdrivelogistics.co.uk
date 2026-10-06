import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { normalizeOnboardingAccountType } from '../../_lib/onboarding';
import {
  buildCurrentLegalEvidence,
  buildCurrentLegalRequirement,
  evaluateLegalAcceptance,
  type LegalAcceptanceSnapshot,
} from '../../../../lib/legal/legalAgreementState';
import type { RegistrationLegalRole } from '../../../../lib/legal/registrationAgreements';
import { LEGAL_LANGUAGES, normalizeLegalLanguage, type LegalLanguage } from '../../../../lib/legal/controlledLegalDocuments';
import { persistSignedLegalAcceptance } from '../../../../lib/legal/persistSignedLegalAcceptance';

const acceptanceSchema = z.object({
  requirementFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  agreementsAccepted: z.literal(true),
  authorityConfirmed: z.literal(true),
  roleDeclarationConfirmed: z.literal(true),
  privacyAcknowledged: z.literal(true),
  languageComprehensionConfirmed: z.literal(true),
  initialEvidenceRemediationConfirmed: z.boolean().optional(),
  language: z.enum(LEGAL_LANGUAGES),
  signerFullName: z.string().trim().min(2).max(120),
});

const LEGAL_ROLE_BY_ACCOUNT_TYPE: Partial<Record<string, RegistrationLegalRole>> = {
  customer_shipper: 'customer_shipper',
  broker_shipper: 'transport_broker',
  owner_driver: 'owner_operator',
  fleet_courier: 'fleet_operator',
};

const LEGAL_ROLE_VALUES = new Set<RegistrationLegalRole>([
  'customer_shipper',
  'transport_broker',
  'owner_operator',
  'fleet_operator',
]);

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const authenticate = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { response: json(503, { error: 'Server auth is not configured.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) return { response: json(401, { error: 'Unauthorized.' }) } as const;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) {
    return { response: json(401, { error: 'Unauthorized: invalid token.' }) } as const;
  }

  return { user: data.user } as const;
};

type LegalAcceptanceRow = {
  id: string;
  registration_role: string;
  legal_version: string;
  agreements: unknown;
  privacy_version: string;
  accepted_at: string;
  source: string;
  acceptance_language: string | null;
  acceptance_statement: string | null;
  language_comprehension_confirmed_at: string | null;
  privacy_document_hash: string | null;
  evidence_hash: string;
  created_at: string;
  signer_full_name?: string | null;
  signature_method?: string | null;
  signature_payload_hash?: string | null;
  signed_pdf_bucket?: string | null;
  signed_pdf_path?: string | null;
  signed_pdf_hash?: string | null;
  signed_pdf_created_at?: string | null;
};

const normalizeAgreementSnapshots = (value: unknown): LegalAcceptanceSnapshot['agreements'] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.code !== 'string' || typeof row.version !== 'string') return [];
    return [{ code: row.code, version: row.version, language: typeof row.language === 'string' && LEGAL_LANGUAGES.includes(row.language as LegalLanguage) ? row.language as LegalLanguage : undefined, translationVersion: typeof row.translationVersion === 'string' ? row.translationVersion : undefined, documentHash: typeof row.documentHash === 'string' ? row.documentHash : undefined }];
  });
};

const toAcceptanceSnapshot = (row: LegalAcceptanceRow): LegalAcceptanceSnapshot => ({
  registrationRole: row.registration_role,
  legalVersion: row.legal_version,
  agreements: normalizeAgreementSnapshots(row.agreements),
  acceptanceLanguage: row.acceptance_language && LEGAL_LANGUAGES.includes(row.acceptance_language as LegalLanguage)
    ? row.acceptance_language as LegalLanguage
    : undefined,
  acceptanceStatement: row.acceptance_statement,
  privacyDocumentHash: row.privacy_document_hash,
});

const loadLegalContext = async (userId: string) => {
  if (!supabaseAdmin) {
    return { response: json(503, { error: 'Server auth is not configured.' }) } as const;
  }

  const [onboardingResult, historyResult] = await Promise.all([
    supabaseAdmin
      .from('onboarding_applications')
      .select('id, account_type, company_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2),
    supabaseAdmin
      .from('registration_legal_acceptances')
      .select('id, registration_role, legal_version, agreements, privacy_version, acceptance_language, acceptance_statement, language_comprehension_confirmed_at, privacy_document_hash, accepted_at, source, evidence_hash, signer_full_name, signature_method, signature_payload_hash, signed_pdf_bucket, signed_pdf_path, signed_pdf_hash, signed_pdf_created_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (onboardingResult.error) {
    return { response: json(500, { error: onboardingResult.error.message }) } as const;
  }

  if (historyResult.error) {
    if (historyResult.error.code === '42P01' || historyResult.error.code === 'PGRST205') {
      return {
        response: json(503, {
          error: 'Legal agreement evidence storage is not available in this environment.',
          code: 'legal_agreement_evidence_schema_missing',
          migrationRequired: '20260904210500_registration_legal_acceptance_evidence.sql',
        }),
      } as const;
    }
    return { response: json(500, { error: historyResult.error.message }) } as const;
  }

  const onboardingRows = onboardingResult.data ?? [];
  if (onboardingRows.length > 1) {
    return {
      response: json(409, {
        error: 'Multiple onboarding applications were found for this user. Platform Owner review is required.',
        code: 'onboarding_application_integrity_violation',
      }),
    } as const;
  }

  const userHistory = (historyResult.data ?? []) as LegalAcceptanceRow[];
  const onboarding = onboardingRows[0] ?? null;
  const normalizedAccountType = onboarding
    ? normalizeOnboardingAccountType(onboarding.account_type)
    : null;

  if (onboarding && !normalizedAccountType) {
    return {
      response: json(409, {
        error: 'The saved onboarding application has an unsupported account type.',
        code: 'unsupported_saved_account_type',
      }),
    } as const;
  }

  let registrationRole: RegistrationLegalRole | null = normalizedAccountType
    ? LEGAL_ROLE_BY_ACCOUNT_TYPE[normalizedAccountType] ?? null
    : null;

  // Only users without an authoritative onboarding record may fall back to
  // immutable server-recorded legal evidence. A current Company Driver
  // (`individual_driver`) record must never inherit a prior self-service role.
  if (!onboarding && !registrationRole && userHistory.length > 0) {
    const candidate = userHistory[0].registration_role;
    if (LEGAL_ROLE_VALUES.has(candidate as RegistrationLegalRole)) {
      registrationRole = candidate as RegistrationLegalRole;
    }
  }

  if (!registrationRole) {
    return {
      response: json(409, {
        error: 'No supported contractual role is available for this account.',
        code: 'legal_contractual_role_unavailable',
      }),
    } as const;
  }

  const companyId = onboarding?.company_id ?? null;
  let history = userHistory.filter((row) => row.registration_role === registrationRole);

  // Contractual acceptance is company-scoped for company-bound workspaces.
  // Preserve signer-specific evidence, but do not force every Owner/Admin user
  // in the same company to re-sign an already-current company agreement.
  if (companyId) {
    const companyHistoryResult = await supabaseAdmin
      .from('registration_legal_acceptances')
      .select('id, registration_role, legal_version, agreements, privacy_version, acceptance_language, acceptance_statement, language_comprehension_confirmed_at, privacy_document_hash, accepted_at, source, evidence_hash, signer_full_name, signature_method, signature_payload_hash, signed_pdf_bucket, signed_pdf_path, signed_pdf_hash, signed_pdf_created_at, created_at')
      .eq('company_id', companyId)
      .eq('registration_role', registrationRole)
      .order('created_at', { ascending: false })
      .limit(100);

    if (companyHistoryResult.error) {
      if (companyHistoryResult.error.code === '42P01' || companyHistoryResult.error.code === 'PGRST205') {
        return {
          response: json(503, {
            error: 'Legal agreement evidence storage is not available in this environment.',
            code: 'legal_agreement_evidence_schema_missing',
            migrationRequired: '20260904210500_registration_legal_acceptance_evidence.sql',
          }),
        } as const;
      }
      return { response: json(500, { error: companyHistoryResult.error.message }) } as const;
    }

    const companyHistory = (companyHistoryResult.data ?? []) as LegalAcceptanceRow[];
    const byId = new Map<string, LegalAcceptanceRow>();
    for (const row of [...companyHistory, ...history]) byId.set(row.id, row);
    history = [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  return {
    registrationRole,
    companyId,
    onboardingApplicationId: onboarding?.id ?? null,
    history,
  } as const;
};

const resolveHistoryState = (
  registrationRole: RegistrationLegalRole,
  history: LegalAcceptanceRow[],
  language: LegalLanguage = 'en',
) => {
  const requirement = buildCurrentLegalRequirement(registrationRole, language);
  const snapshots = history.map(toAcceptanceSnapshot);

  // Legal readiness is bound to the language actually signed, not to whichever
  // translation the user is currently viewing. A current Romanian acceptance,
  // for example, remains current when the page is reopened with English selected.
  const currentAcceptanceIndex = snapshots.findIndex((snapshot) => {
    const signedLanguage = snapshot.acceptanceLanguage ?? 'en';
    const signedRequirement = buildCurrentLegalRequirement(registrationRole, signedLanguage);
    return !evaluateLegalAcceptance(signedRequirement, snapshot).requiresReacceptance;
  });

  const latestSnapshot = snapshots[0] ?? null;
  const latestLanguage = latestSnapshot?.acceptanceLanguage ?? language;
  const latestRequirement = buildCurrentLegalRequirement(registrationRole, latestLanguage);
  const latestEvaluation = evaluateLegalAcceptance(latestRequirement, latestSnapshot);

  return {
    requirement,
    currentAcceptanceIndex,
    requiresReacceptance: currentAcceptanceIndex === -1,
    reacceptanceReasons:
      currentAcceptanceIndex === -1 ? latestEvaluation.reasons : [],
  };
};

const buildReadModel = (
  registrationRole: RegistrationLegalRole,
  history: LegalAcceptanceRow[],
  language: LegalLanguage,
) => {
  const state = resolveHistoryState(registrationRole, history, language);
  const { requirement } = state;

  return {
    currentRequirement: {
      registrationRole: requirement.registrationRole,
      legalVersion: requirement.legalVersion,
      privacyVersion: requirement.privacyVersion,
      acceptanceLanguage: requirement.acceptanceLanguage,
      privacyDocumentHash: requirement.privacyDocumentHash,
      agreements: requirement.agreements,
      acceptanceStatement: requirement.acceptanceStatement,
      authorityStatement: requirement.authorityStatement,
      roleStatement: requirement.roleStatement,
      privacyStatement: requirement.privacyStatement,
      requirementFingerprint: requirement.requirementFingerprint,
    },
    requiresReacceptance: state.requiresReacceptance,
    reacceptanceReasons: state.reacceptanceReasons,
    history: history.map((row, index) => ({
      id: row.id,
      registrationRole: row.registration_role,
      legalVersion: row.legal_version,
      agreements: normalizeAgreementSnapshots(row.agreements),
      privacyVersion: row.privacy_version,
      acceptanceLanguage: row.acceptance_language ?? 'legacy',
      languageComprehensionConfirmedAt: row.language_comprehension_confirmed_at ?? null,
      privacyDocumentHash: row.privacy_document_hash,
      acceptedAt: row.accepted_at,
      source: row.source,
      evidenceHash: row.evidence_hash,
      signerFullName: row.signer_full_name ?? null,
      signatureMethod: row.signature_method ?? null,
      signaturePayloadHash: row.signature_payload_hash ?? null,
      signedPdfAvailable: Boolean(row.signed_pdf_bucket && row.signed_pdf_path && row.signed_pdf_hash),
      signedPdfHash: row.signed_pdf_hash ?? null,
      signedPdfCreatedAt: row.signed_pdf_created_at ?? null,
      createdAt: row.created_at,
      status: index === state.currentAcceptanceIndex ? 'current' : 'superseded',
    })),
  };
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const context = await loadLegalContext(auth.user.id);
  if ('response' in context) return context.response;

  const language = normalizeLegalLanguage(request.nextUrl.searchParams.get('language'));
  return json(200, { ...buildReadModel(context.registrationRole, context.history, language), context: { userId: auth.user.id, companyId: context.companyId, onboardingApplicationId: context.onboardingApplicationId } });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  let payload: z.infer<typeof acceptanceSchema>;
  try {
    const parsed = acceptanceSchema.safeParse(await request.json());
    if (!parsed.success) return json(400, { error: 'Invalid legal acceptance payload.' });
    payload = parsed.data;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const context = await loadLegalContext(auth.user.id);
  if ('response' in context) return context.response;

  const state = resolveHistoryState(context.registrationRole, context.history, payload.language);
  const { requirement } = state;
  if (payload.requirementFingerprint !== requirement.requirementFingerprint) {
    return json(409, {
      error: 'The legal requirement changed before acceptance. Reload the current agreements before continuing.',
      code: 'legal_requirement_stale',
      requirementFingerprint: requirement.requirementFingerprint,
    });
  }

  if (!state.requiresReacceptance) {
    return json(409, {
      error: 'No legal acceptance action is currently required.',
      code: 'legal_reacceptance_not_required',
    });
  }

  const isInitialRemediation = context.history.length === 0;

  // A legacy account with no immutable evidence may accept the current package now,
  // but this event must never be represented as a historical registration event.
  // The extra acknowledgement makes that boundary explicit and auditable.
  if (isInitialRemediation && payload.initialEvidenceRemediationConfirmed !== true) {
    return json(400, {
      error: 'Initial legal evidence remediation must be explicitly acknowledged.',
      code: 'initial_legal_remediation_confirmation_required',
    });
  }

  const acceptedAt = new Date().toISOString();
  const evidence = buildCurrentLegalEvidence(context.registrationRole, acceptedAt, payload.language);
  const acceptanceSource = isInitialRemediation ? 'initial_remediation' : 'material_reacceptance';

  const persisted = await persistSignedLegalAcceptance({
    supabaseAdmin: supabaseAdmin!,
    userId: auth.user.id,
    userEmail: auth.user.email ?? null,
    companyId: context.companyId,
    onboardingApplicationId: isInitialRemediation ? context.onboardingApplicationId : null,
    evidence,
    signerFullName: payload.signerFullName,
    source: acceptanceSource,
    userAgent: request.headers.get('user-agent'),
  });
  const inserted = persisted.data;
  const error = persisted.error;

  if (error) {
    const errorCode = String(error.code ?? '');
    if (['42P01', 'PGRST205', '42703'].includes(errorCode)) {
      return json(503, {
        error: 'Signed legal agreement storage is not available in this environment.',
        code: 'legal_signature_schema_missing',
        migrationRequired: '20260926150657_signed_legal_agreement_package.sql',
      });
    }
    if (errorCode === '23514') {
      return json(503, {
        error: 'Signed legal agreement validation is not enabled in this environment.',
        code: 'legal_signature_validation_unavailable',
        migrationRequired: '20260926150657_signed_legal_agreement_package.sql',
      });
    }
    if (errorCode === '23505') {
      return json(409, {
        error: 'This contractual requirement has already been accepted.',
        code: isInitialRemediation ? 'initial_legal_remediation_already_recorded' : 'legal_reacceptance_already_recorded',
        reloadRequired: true,
      });
    }
    return json(500, {
      error: isInitialRemediation ? 'Signed initial legal remediation could not be persisted.' : 'Signed legal re-acceptance could not be persisted.',
      code: isInitialRemediation ? 'initial_legal_remediation_persistence_failed' : 'legal_reacceptance_persistence_failed',
    });
  }

  const insertedRow = inserted as LegalAcceptanceRow;
  return json(201, {
    accepted: true,
    acceptanceMode: acceptanceSource,
    acceptance: {
      id: insertedRow.id,
      registrationRole: insertedRow.registration_role,
      legalVersion: insertedRow.legal_version,
      agreements: normalizeAgreementSnapshots(insertedRow.agreements),
      privacyVersion: insertedRow.privacy_version,
      acceptanceLanguage: insertedRow.acceptance_language ?? evidence.acceptanceLanguage,
      languageComprehensionConfirmedAt: insertedRow.language_comprehension_confirmed_at ?? evidence.acceptedAt,
      privacyDocumentHash: insertedRow.privacy_document_hash,
      acceptedAt: insertedRow.accepted_at,
      source: insertedRow.source,
      evidenceHash: insertedRow.evidence_hash,
      createdAt: insertedRow.created_at,
      status: 'current',
    },
    currentRequirement: {
      registrationRole: requirement.registrationRole,
      legalVersion: requirement.legalVersion,
      privacyVersion: requirement.privacyVersion,
      acceptanceLanguage: requirement.acceptanceLanguage,
      privacyDocumentHash: requirement.privacyDocumentHash,
      requirementFingerprint: requirement.requirementFingerprint,
    },
    requiresReacceptance: false,
    reacceptanceReasons: [],
  });
}
