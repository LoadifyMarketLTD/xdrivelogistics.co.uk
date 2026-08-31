import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Super Admin compliance convergence', () => {
  it('uses the shared active Platform Owner authority boundary', () => {
    const genericRoute = readRepoFile('app/api/super-admin/compliance/route.ts');
    const documentsRoute = readRepoFile('app/api/super-admin/compliance/documents/route.ts');

    expect(genericRoute).toContain('verifyPlatformOwner(request)');
    expect(documentsRoute).toContain('verifyPlatformOwner(request)');
    expect(documentsRoute).toContain('Forbidden: active Platform Owner required.');
    expect(documentsRoute).not.toContain('profile?.role !==');
  });

  it('uses the canonical atomic compliance review RPC instead of split update plus audit', () => {
    const genericRoute = readRepoFile('app/api/super-admin/compliance/route.ts');
    const documentsRoute = readRepoFile('app/api/super-admin/compliance/documents/route.ts');

    expect(genericRoute).toContain("supabaseAdmin.rpc('owner_review_compliance_document'");
    expect(documentsRoute).toContain("supabaseAdmin.rpc('owner_review_compliance_document'");
    expect(genericRoute).not.toContain(".from(table)\n    .update(");
  });

  it('requires an explicit reason for document rejection', () => {
    const genericRoute = readRepoFile('app/api/super-admin/compliance/route.ts');
    const documentsRoute = readRepoFile('app/api/super-admin/compliance/documents/route.ts');

    expect(genericRoute).toContain('A rejection reason of at least 5 characters is required.');
    expect(documentsRoute).toContain('A rejection reason of at least 5 characters is required.');
  });

  it('resolves each compliance document to its authoritative entity when possible', () => {
    const documentsRoute = readRepoFile('app/api/super-admin/compliance/documents/route.ts');
    const page = readRepoFile('app/super-admin/compliance/documents/page.tsx');

    expect(documentsRoute).toContain('inspector_entity_type');
    expect(documentsRoute).toContain('inspector_entity_id');
    expect(documentsRoute).toContain(".select('id, user_id, email, account_type, company_id, payload')");
    expect(page).toContain('entityLink={(row) => row.inspector_entity_type && row.inspector_entity_id');
  });

  it('keeps document preview private and auditable', () => {
    const documentsRoute = readRepoFile('app/api/super-admin/compliance/documents/route.ts');

    expect(documentsRoute).toContain('createSignedUrl(storageObject.objectPath, 300)');
    expect(documentsRoute).toContain("action_type: 'document_viewed'");
    expect(documentsRoute).toContain('if (auditError) return respond(500');
  });
});
