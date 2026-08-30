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
  });

  it('keeps company activation fail-closed through the full onboarding compliance assertion', () => {
    const hardening = readRepoFile(
      'supabase/migrations/20260830202500_harden_company_compliance_identity_gate.sql',
    );

    expect(hardening).toContain('CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready');
    expect(hardening).toContain('PERFORM public.assert_onboarding_compliance_ready(v_application_id);');
    expect(hardening).not.toContain('v_has_required_company_documents');
    expect(hardening).toContain("REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM authenticated");
  });

  it('includes rollback-only final runtime proof for owner-driver and fleet compliance', () => {
    const runtimeProof = readRepoFile(
      'supabase/migrations/20260830202600_verify_company_compliance_identity_gate_runtime.sql',
    );

    expect(runtimeProof).toContain('Visual Audit P0-10 Final');
    expect(runtimeProof).toContain('@example.test');
    expect(runtimeProof).toContain('Owner Driver company activation bypassed missing identity compliance');
    expect(runtimeProof).toContain('Fleet company activation bypassed missing company compliance');
    expect(runtimeProof).toContain("ARRAY['driving_licence','proof_of_address','right_to_work']::text[]");
    expect(runtimeProof).toContain("'driving_licence', 'p010/licence.pdf', 'uploaded', 'verified'");
    expect(runtimeProof).toContain("'vehicle_insurance', 'p010/vehicle-insurance.pdf', 'approved'");
    expect(runtimeProof).toContain('rollback final synthetic company compliance fixture');
    expect(runtimeProof).toContain('Final synthetic auth fixture did not roll back cleanly');
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
