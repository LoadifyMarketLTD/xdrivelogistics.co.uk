import fs from 'node:fs';
import path from 'node:path';

describe('Owner Driver remediation contract', () => {
  const vehiclesApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/vehicles/route.ts'),
    'utf8',
  );
  const vehiclesPage = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/vehicles/page.tsx'),
    'utf8',
  );
  const roleCapabilities = fs.readFileSync(
    path.join(process.cwd(), 'lib/roleCapabilities.ts'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830020916_repair_owner_driver_document_storage_contract.sql'),
    'utf8',
  );
  const onboardingQueueApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/super-admin/onboarding/route.ts'),
    'utf8',
  );
  const onboardingReviewApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/super-admin/onboarding/[id]/route.ts'),
    'utf8',
  );
  const onboardingReviewQueue = fs.readFileSync(
    path.join(process.cwd(), 'app/super-admin/compliance/documents/OnboardingReviewQueue.tsx'),
    'utf8',
  );
  const documentReviewPage = fs.readFileSync(
    path.join(process.cwd(), 'app/super-admin/compliance/documents/page.tsx'),
    'utf8',
  );

  test('provides controlled same-company Assign to me without silent reassignment', () => {
    expect(vehiclesApi).toContain("action: z.literal('assign_to_me')");
    expect(vehiclesApi).toContain('This vehicle is already assigned to another Driver.');
    expect(vehiclesApi).toContain('You already have an active assigned vehicle');
    expect(vehiclesApi).toContain(".eq('company_id', companyId)");
    expect(vehiclesApi).toContain(".is('assigned_driver_id', null)");
    expect(vehiclesApi).toContain("String(vehicle.status ?? '').trim().toLowerCase() !== 'active'");
    expect(vehiclesPage).toContain('Assign to me');
    expect(vehiclesPage).toContain("action: 'assign_to_me'");
  });

  test('allows only compliance remediation before app access while commercial routes stay closed', () => {
    expect(roleCapabilities).toContain("path === '/driver/documents'");
    expect(roleCapabilities).toContain("path === '/driver/vehicles'");
    expect(roleCapabilities).toContain('!isChangePasswordRoute && !isComplianceRemediationRoute && context.appAccess !== true');
    expect(roleCapabilities).toContain('isDriverCommercialRoute(path)');
  });

  test('reconciles the hosted storage migration without destructive orphan cleanup', () => {
    expect(migration).toContain("WHERE id = 'driver-docs'");
    expect(migration).toContain("'image/webp'");
    expect(migration).toContain('/storage/v1/object/sign/driver-docs/');
    expect(migration).toContain("o.bucket_id = 'driver-docs'");
    expect(migration).toContain('o.name = c.object_path');
    expect(migration).not.toMatch(/DELETE\s+FROM\s+storage\.objects/i);
  });

  test('exposes Platform Owner onboarding approval without bypassing canonical review guards', () => {
    expect(onboardingQueueApi).toContain("from '../../_lib/supabaseAdmin'");
    expect(onboardingQueueApi).toContain("profile?.role !== 'owner'");
    expect(onboardingQueueApi).toContain(".in('status', ['submitted', 'under_review', 'request_changes'])");
    expect(onboardingQueueApi).toContain("'get_missing_onboarding_documents'");
    expect(onboardingQueueApi).toContain("riskStatus === 'clear'");
    expect(onboardingQueueApi).toContain('missingDocuments.length === 0');
    expect(onboardingQueueApi).toContain("['rejected', 'suspended'].includes(companyStatus)");
    expect(onboardingQueueApi).toContain('!companyGovernanceBlocked');

    expect(onboardingReviewApi).toContain("profile.role !== 'owner'");
    expect(onboardingReviewApi).toContain("z.enum(['approve', 'reject', 'request_changes'])");
    expect(onboardingReviewApi).toContain(".rpc('review_onboarding_application_atomic'");

    expect(documentReviewPage).toContain('OnboardingReviewQueue');
    expect(onboardingReviewQueue).toContain('Onboarding approval queue');
    expect(onboardingReviewQueue).toContain('Approve onboarding');
    expect(onboardingReviewQueue).toContain('Request changes');
    expect(onboardingReviewQueue).toContain('Reject onboarding');
    expect(onboardingReviewQueue).toContain('disabled={busy || !row.ready_for_approval}');
    expect(onboardingReviewQueue).toContain('row.company_governance_blocked');
    expect(onboardingReviewQueue).toContain("fetch(`/api/super-admin/onboarding/${row.id}`");
  });
});
