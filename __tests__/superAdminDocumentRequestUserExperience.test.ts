import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin document request user experience', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  test('user-side checklist is authenticated and Deploy Preview housekeeping fails closed', () => {
    const route = read('app/api/onboarding/missing-documents/route.ts');
    expect(route).toContain("getBearerToken(request)");
    expect(route).toContain("supabaseAdmin.rpc('get_missing_onboarding_documents'");
    expect(route).toContain('missingDocuments.length === 0 && !isDeployPreviewReadOnly()');
    expect(route).toContain("await supabaseAdmin.rpc('resolve_completed_document_requests'");
    expect(route).not.toContain(".rpc('resolve_completed_document_requests', { p_application_id: application.id }).catch");
  });

  test('canonical checklist is mounted once for every onboarding variant', () => {
    const layout = read('app/onboarding/layout.tsx');
    const checklist = read('app/onboarding/_components/OnboardingDocumentChecklist.tsx');
    expect(layout).toContain('<OnboardingDocumentChecklist />');
    expect(checklist).toContain("fetch('/api/onboarding/missing-documents'");
    expect(checklist).toContain('This reminder remains visible until the canonical requirements are complete.');
    expect(checklist).toContain('60_000');
  });

  test('Verification uses canonical onboarding rows and server-derived document request preflight', () => {
    const page = read('app/super-admin/companies/verification/page.tsx');
    expect(page).toContain("fetch('/api/super-admin/onboarding'");
    expect(page).toContain('/request-documents`');
    expect(page).toContain("body: JSON.stringify({ reason: reason.trim(), reminder })");
    expect(page).not.toContain('requestedDocuments');
    expect(page).toContain('Request documents');
    expect(page).toContain('Send reminder');
    expect(page).toContain('Send request by email');
    expect(page).toContain('Preview — sending disabled');
  });

  test('Verification preserves the existing light XDrive visual family without preview stylesheet imports', () => {
    const page = read('app/super-admin/companies/verification/page.tsx');
    expect(page).toContain("pageBg: '#F4F6F8'");
    expect(page).toContain("heading: '#0B2F6B'");
    expect(page).toContain("blue: '#1D57D8'");
    expect(page).toContain("accent: '#F5A300'");
    expect(page).not.toContain('super-admin-visual-preview.css');
    expect(page).not.toContain('PR #359');
  });
});
