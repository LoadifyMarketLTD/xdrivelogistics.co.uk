import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  COMPANY_DRIVER_DOCUMENT_TYPES,
  ONBOARDING_CONTRACT,
  getOnboardingContract,
  getRequiredOnboardingDocuments,
  normalizeCanonicalOnboardingAccountType,
  toPersistedOnboardingAccountType,
} from '../lib/onboardingContract';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('canonical onboarding contract', () => {
  it('maps Company Driver to the invitation-only driver flow, never to Fleet Company', () => {
    expect(normalizeCanonicalOnboardingAccountType('company_driver')).toBe('company_driver');
    expect(normalizeCanonicalOnboardingAccountType('individual_driver')).toBe('company_driver');
    expect(toPersistedOnboardingAccountType('company_driver')).toBe('individual_driver');

    const contract = getOnboardingContract('company_driver');
    expect(contract?.publicRegistration).toBe(false);
    expect(contract?.createsCompanyWorkspace).toBe(false);
    expect(contract?.persistedAccountType).toBe('individual_driver');
    expect(contract?.routeSegment).toBe('individual-driver');
  });

  it('uses one document list for every account and marks conditional evidence explicitly', () => {
    const companyDriverDocuments = ONBOARDING_CONTRACT.company_driver.documents.map((item) => item.type);
    expect(companyDriverDocuments).toEqual([...COMPANY_DRIVER_DOCUMENT_TYPES]);

    expect(getRequiredOnboardingDocuments('company_driver').map((item) => item.type)).toEqual([
      'driving_licence',
      'proof_of_address',
      'right_to_work',
    ]);
    expect(getRequiredOnboardingDocuments('owner_driver').map((item) => item.type)).toEqual([
      'driving_licence',
      'proof_of_address',
      'right_to_work',
    ]);
    expect(getRequiredOnboardingDocuments('fleet_courier').map((item) => item.type)).toEqual([
      'company_registration',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
    ]);
    expect(getRequiredOnboardingDocuments('broker_shipper').map((item) => item.type)).toEqual([
      'company_registration',
      'public_liability',
    ]);

    const ownerInsurance = ONBOARDING_CONTRACT.owner_driver.documents.find(
      (item) => item.type === 'insurance',
    );
    expect(ownerInsurance?.requirement).toBe('conditional');
    expect(ownerInsurance?.condition).toContain('never blocks onboarding');
  });

  it('keeps the current SQL compliance matrix aligned with the TypeScript contract', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830201500_reconcile_company_compliance_contract.sql',
    );

    for (const contract of Object.values(ONBOARDING_CONTRACT)) {
      for (const document of contract.documents) {
        const required = document.requirement === 'required' ? 'true' : 'false';
        expect(migration).toContain(
          `('${contract.persistedAccountType}', '${document.family}', '${document.type}', ${required}, true`,
        );
      }
    }

    expect(migration).toContain("doc_type = 'motor_fleet_insurance'");
    expect(migration).toContain("NEW.doc_type := 'vehicle_insurance'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready');
    expect(migration).toContain('v_has_required_company_documents');
    expect(migration).toContain('IF v_has_required_company_documents THEN');
    expect(migration).toContain('PERFORM public.assert_onboarding_compliance_ready(v_application_id);');
  });

  it('includes rollback-only runtime proof for owner-driver and fleet company compliance', () => {
    const runtimeProof = readRepoFile(
      'supabase/migrations/20260830201600_verify_company_compliance_contract_runtime.sql',
    );

    expect(runtimeProof).toContain('Visual Audit');
    expect(runtimeProof).toContain('example.test');
    expect(runtimeProof).toContain('rollback company document alias probe');
    expect(runtimeProof).toContain('rollback owner driver company readiness probe');
    expect(runtimeProof).toContain('rollback fleet company readiness probe');
    expect(runtimeProof).toContain("ARRAY['driving_licence','proof_of_address','right_to_work']::text[]");
    expect(runtimeProof).toContain("ARRAY['company_registration','goods_in_transit','public_liability','vehicle_insurance']::text[]");
    expect(runtimeProof).toContain('Fleet company readiness did not fail closed');
  });

  it('forces invited drivers into pending verification until a reviewed approval activates them', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260729170000_unified_onboarding_contract_and_activation_gate.sql',
    );

    expect(migration).toContain('ensure_company_driver_onboarding');
    expect(migration).toContain("NEW.status := 'pending_verification'");
    expect(migration).toContain('NEW.app_access := false');
    expect(migration).toContain('trg_profiles_driver_identity_gate');
    expect(migration).toContain('trg_drivers_identity_gate');
    expect(migration).toContain('trg_company_memberships_driver_identity_gate');
    expect(migration).toContain('trg_activate_approved_onboarding_identity');
    expect(migration).toMatch(/SET status = 'active',\s+app_access = true/);
  });

  it('requires a company-linked invitation in init, session and submit APIs', () => {
    const initRoute = readRepoFile('app/api/onboarding/init/route.ts');
    const sessionRoute = readRepoFile('app/api/onboarding/individual-driver/session/route.ts');
    const submitRoute = readRepoFile('app/api/onboarding/submit/individual-driver/route.ts');

    expect(initRoute).toContain('isCompanyDriverOnboardingApplication');
    expect(initRoute).toContain('company_driver_invitation_required');
    expect(sessionRoute).toContain('isCompanyDriverOnboardingApplication');
    expect(submitRoute).toContain('isCompanyDriverOnboardingApplication');
    expect(submitRoute).toContain('Company Driver onboarding is invitation-only');
  });

  it('renders onboarding documents from the canonical contract instead of local role lists', () => {
    const page = readRepoFile('app/onboarding/[token]/page.tsx');

    expect(page).toContain('getOnboardingContract');
    expect(page).toContain('contract?.documents');
    expect(page).toContain("canonicalAccountType === 'company_driver'");
    expect(page).not.toContain("const fleetDocs =");
    expect(page).not.toContain("const ownerDriverDocs =");
  });
});
