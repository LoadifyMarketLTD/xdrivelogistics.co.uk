import fs from 'node:fs';
import path from 'node:path';

describe('Canonical Driver compliance remediation contract', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830135351_backfill_legacy_driver_compliance_remediation.sql'),
    'utf8',
  );
  const ownerDriverRequirementMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830142705_owner_driver_address_and_insurance_requirement.sql'),
    'utf8',
  );
  const resolver = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/compliance/_lib.ts'),
    'utf8',
  );
  const remediationApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/compliance/remediation/route.ts'),
    'utf8',
  );
  const vehicleDocumentsApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/compliance/vehicle-documents/route.ts'),
    'utf8',
  );
  const documentsPage = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/documents/page.tsx'),
    'utf8',
  );
  const loadsPage = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/loads/page.tsx'),
    'utf8',
  );

  test('legacy backfill creates remediation applications without approving identities or changing access', () => {
    expect(migration).toContain("'under_review'");
    expect(migration).toContain("'compliance_remediation'");
    expect(migration).toContain("'legacy_driver_compliance_remediation', true");
    expect(migration).toContain('ON CONFLICT (user_id) DO NOTHING');
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.platform_identity_registry/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.drivers/i);
    expect(migration).not.toMatch(/app_access\s*=/i);
  });

  test('remediation authentication stays active-company scoped without requiring app access', () => {
    expect(resolver).toContain(".from('drivers')");
    expect(resolver).toContain(".from('company_memberships')");
    expect(resolver).toContain(".from('companies')");
    expect(resolver).toContain("String(driver.status ?? '').toLowerCase() !== 'active'");
    expect(resolver).not.toContain('app_access !== true');
  });

  test('owner driver address proof can be satisfied by a verified driving licence and personal insurance is optional', () => {
    expect(ownerDriverRequirementMigration).toContain("doc_type = 'insurance'");
    expect(ownerDriverRequirementMigration).toContain('required = false');
    expect(ownerDriverRequirementMigration).toContain("requirement.doc_type = 'proof_of_address'");
    expect(ownerDriverRequirementMigration).toContain("licence.doc_type = 'driving_licence'");
    expect(remediationApi).toContain("'driving_licence',\n  'proof_of_address',\n  'right_to_work',");
    expect(remediationApi).not.toContain("'right_to_work',\n  'insurance',\n] as const;");
    expect(remediationApi).toContain("docType === 'proof_of_address' && currentVerifiedIdentityDocument('driving_licence')");
    expect(documentsPage).toContain('Driving Licence satisfies Proof of Address');
    expect(documentsPage).toContain('Verified Driving Licence accepted as address evidence');
  });

  test('approved legacy evidence is copied into canonical onboarding storage without silent re-approval', () => {
    expect(remediationApi).toContain("action !== 'reconcile_legacy_identity_documents'");
    expect(remediationApi).toContain(".from('driver-docs')");
    expect(remediationApi).toContain(".from('onboarding-documents')");
    expect(remediationApi).toContain("verification_status: 'verified'");
    expect(remediationApi).toContain('original review preserved');
    expect(remediationApi).toContain("fingerprint.user_id !== resolved.userId");
    expect(remediationApi).not.toContain("LEGACY_MAP['Other']");
  });

  test('vehicle compliance upload is server-authoritative and bound to the assigned active vehicle', () => {
    expect(vehicleDocumentsApi).toContain("z.enum(['mot', 'insurance'])");
    expect(vehicleDocumentsApi).toContain('vehicle.company_id !== resolved.companyId');
    expect(vehicleDocumentsApi).toContain('vehicle.assigned_driver_id !== resolved.driverId');
    expect(vehicleDocumentsApi).toContain("String(vehicle.status ?? '').trim().toLowerCase() !== 'active'");
    expect(vehicleDocumentsApi).toContain(".from('vehicle-docs')");
    expect(vehicleDocumentsApi).toContain("status: 'pending'");
  });

  test('Driver Documents uses canonical onboarding and vehicle compliance routes', () => {
    expect(documentsPage).toContain("fetch('/api/onboarding/documents'");
    expect(documentsPage).toContain("fetch('/api/driver/compliance/vehicle-documents'");
    expect(documentsPage).toContain("fetch('/api/driver/compliance/remediation'");
    expect(documentsPage).not.toContain("fetch('/api/driver/documents'");
    expect(documentsPage).toContain('nothing is silently re-approved');
  });

  test('Load Board keeps browsing available while quote UI follows canonical eligibility', () => {
    expect(loadsPage).toContain("fetch('/api/driver/compliance/eligibility'");
    expect(loadsPage).toContain('const quoteAllowed = quoteEligibility?.eligible === true');
    expect(loadsPage).toContain('!quoted && quoteAllowed');
    expect(loadsPage).toContain('!quoted && !quoteAllowed');
    expect(loadsPage).toContain('Complete compliance to quote');
    expect(loadsPage).toContain('if (!quoteAllowed)');
  });
});
