import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8');

describe('Onboarding document checklist convergence', () => {
  it('keeps canonical missing-document truth server-authoritative', () => {
    const route = read('app/api/onboarding/missing-documents/route.ts');
    expect(route).toContain("supabaseAdmin.rpc('get_missing_onboarding_documents'");
    expect(route).toContain(".from('compliance_document_requirements')");
    expect(route).toContain(".from('company_documents')");
    expect(route).toContain(".from('driver_identity_documents')");
    expect(route).not.toContain('filePath:');
  });

  it('does not perform housekeeping writes from Deploy Preview', () => {
    const route = read('app/api/onboarding/missing-documents/route.ts');
    expect(route).toContain('isDeployPreviewReadOnly');
    expect(route).toContain('missingDocuments.length === 0 && !isDeployPreviewReadOnly()');
    expect(route).toContain("supabaseAdmin.rpc('resolve_completed_document_requests'");
  });

  it('shows durable document lifecycle states without exposing stored file paths', () => {
    const checklist = read('app/onboarding/_components/OnboardingDocumentChecklist.tsx');
    expect(checklist).toContain('Uploaded · pending review');
    expect(checklist).toContain('Expiring soon');
    expect(checklist).toContain('Rejected');
    expect(checklist).not.toContain('file_path');
  });

  it('is inherited by every onboarding route through the onboarding layout', () => {
    const layout = read('app/onboarding/layout.tsx');
    expect(layout).toContain('<OnboardingDocumentChecklist />');
  });
});
