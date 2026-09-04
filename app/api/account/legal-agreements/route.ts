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

const reacceptanceSchema = z.object({
  requirementFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  agreementsAccepted: z.literal(true),
  authorityConfirmed: z.literal(true),
  roleDeclarationConfirmed: z.literal(true),
  privacyAcknowledged: z.literal(true),
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
  evidence_hash: string;
  created_at: string;
};

const normalizeAgreementSnapshots = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.code !== 'string' || typeof row.version !== 'string') return [];
    return [{ code: row.code, version: row.version }];
  });
};

const toAcceptanceSnapshot = (row: LegalAcceptanceRow): LegalAcceptanceSnapshot => ({
  registrationRole: row.registration_role,
  legalVersion: row.legal_version,
  agreements: normalizeAgreementSnapshots(row.agreements),
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
      .select('id, registration_role, legal_version, agreements, privacy_version, accepted_at, source, evidence_hash, created_at')
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

  const history = (historyResult.data ?? []) as LegalAcceptanceRow[];
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
  if (!onboarding && !registrationRole && history.length > 0) {
    const candidate = history[0].registration_role;
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

  return {
    registrationRole,
    companyId: onboarding?.company_id ?? null,
    history,
  } as const;
};

const buildReadModel = (
  registrationRole: RegistrationLegalRole,
  history: LegalAcceptanceRow[],
) => {
  const requirement = buildCurrentLegalRequirement(registrationRole);
  const latest = history[0] ? toAcceptanceSnapshot(history[0]) : null;
  const evaluation = evaluateLegalAcceptance(requirement, latest);

  return {
    currentRequirement: {
      registrationRole: requirement.registrationRole,
      legalVersion: requirement.legalVersion,
      privacyVersion: requirement.privacyVersion,
      agreements: requirement.agreements,
      acceptanceStatement: requirement.acceptanceStatement,
      authorityStatement: requirement.authorityStatement,
      roleStatement: requirement.roleStatement,
      privacyStatement: requirement.privacyStatement,
      requirementFingerprint: requirement.requirementFingerprint,
    },
    requiresReacceptance: evaluation.requiresReacceptance,
    reacceptanceReasons: evaluation.reasons,
    history: history.map((row, index) => ({
      id: row.id,
      registrationRole: row.registration_role,
      legalVersion: row.legal_version,
      agreements: normalizeAgreementSnapshots(row.agreements),
      privacyVersion: row.privacy_version,
      acceptedAt: row.accepted_at,
      source: row.source,
      evidenceHash: row.evidence_hash,
      createdAt: row.created_at,
      status: index === 0 && !evaluation.requiresReacceptance ? 'current' : 'superseded',
    })),
  };
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const context = await loadLegalContext(auth.user.id);
  if ('response' in context) return context.response;

  return json(200, buildReadModel(context.registrationRole, context.history));
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  let payload: z.infer<typeof reacceptanceSchema>;
  try {
    const parsed = reacceptanceSchema.safeParse(await request.json());
    if (!parsed.success) return json(400, { error: 'Invalid legal re-acceptance payload.' });
    payload = parsed.data;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const context = await loadLegalContext(auth.user.id);
  if ('response' in context) return context.response;

  const requirement = buildCurrentLegalRequirement(context.registrationRole);
  if (payload.requirementFingerprint !== requirement.requirementFingerprint) {
    return json(409, {
      error: 'The legal requirement changed before acceptance. Reload the current agreements before continuing.',
      code: 'legal_requirement_stale',
      requirementFingerprint: requirement.requirementFingerprint,
    });
  }

  const latest = context.history[0] ? toAcceptanceSnapshot(context.history[0]) : null;
  const evaluation = evaluateLegalAcceptance(requirement, latest);
  if (!evaluation.requiresReacceptance) {
    return json(409, {
      error: 'No material legal re-acceptance is currently required.',
      code: 'legal_reacceptance_not_required',
    });
  }

  const acceptedAt = new Date().toISOString();
  const evidence = buildCurrentLegalEvidence(context.registrationRole, acceptedAt);

  const { data: inserted, error } = await supabaseAdmin!
    .from('registration_legal_acceptances')
    .insert({
      user_id: auth.user.id,
      company_id: context.companyId,
      onboarding_application_id: null,
      registration_role: evidence.registrationRole,
      legal_version: evidence.legalVersion,
      agreements: evidence.agreements,
      acceptance_statement: evidence.acceptanceStatement,
      authority_statement: evidence.authorityStatement,
      role_statement: evidence.roleStatement,
      privacy_statement: evidence.privacyStatement,
      privacy_version: evidence.privacyVersion,
      accepted_at: evidence.acceptedAt,
      source: 'material_reacceptance',
      user_agent: request.headers.get('user-agent'),
      evidence_hash: evidence.evidenceHash,
    })
    .select('id, registration_role, legal_version, agreements, privacy_version, accepted_at, source, evidence_hash, created_at')
    .single();

  if (error) {
    if (
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.code === '23514'
    ) {
      return json(503, {
        error: 'Material legal re-acceptance storage is not available in this environment.',
        code: 'legal_reacceptance_schema_missing',
        migrationRequired: '20260904210500_registration_legal_acceptance_evidence.sql',
      });
    }
    return json(500, {
      error: 'Legal re-acceptance could not be persisted.',
      code: 'legal_reacceptance_persistence_failed',
    });
  }

  const insertedRow = inserted as LegalAcceptanceRow;
  return json(201, {
    accepted: true,
    acceptance: {
      id: insertedRow.id,
      registrationRole: insertedRow.registration_role,
      legalVersion: insertedRow.legal_version,
      agreements: normalizeAgreementSnapshots(insertedRow.agreements),
      privacyVersion: insertedRow.privacy_version,
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
      requirementFingerprint: requirement.requirementFingerprint,
    },
    requiresReacceptance: false,
    reacceptanceReasons: [],
  });
}
