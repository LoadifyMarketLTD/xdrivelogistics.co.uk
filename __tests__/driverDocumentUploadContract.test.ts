import fs from 'node:fs';
import path from 'node:path';

describe('Driver compliance document upload contract', () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/documents/page.tsx'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/documents/route.ts'),
    'utf8',
  );

  test('browser submits documents to the authenticated server endpoint', () => {
    expect(page).toContain("fetch('/api/driver/documents'");
    expect(page).toContain("Authorization: `Bearer ${token}`");
    expect(page).toContain("formData.set('file', file, file.name)");
    expect(page).not.toContain("supabase.storage.from('driver-docs').upload");
    expect(page).not.toMatch(/\.from\('driver_documents'\)\.insert\(/);
  });

  test('server owns tenant-bound storage and record creation', () => {
    expect(route).toContain('requireWebDriver(request, { requireOperationallyActive: false })');
    expect(route).toContain("supabaseAdmin.storage\n    .from('driver-docs')");
    expect(route).toContain(".from('driver_documents')");
    expect(route).toContain('driver_id: context.driverId');
    expect(route).toContain("status: 'pending'");
    expect(route).toContain('const uploadFolder = context.companyId ?? context.driverId');
  });

  test('validates content and compensates a failed database insert', () => {
    expect(route).toContain('MAX_DOCUMENT_BYTES = 10 * 1024 * 1024');
    expect(route).toContain('hasExpectedMagicBytes');
    expect(route).toContain("'application/pdf'");
    expect(route).toContain("'image/jpeg'");
    expect(route).toContain("'image/png'");
    expect(route).toContain("'image/webp'");
    expect(route).toContain("supabaseAdmin.storage.from('driver-docs').remove([storagePath])");
    expect(route).toContain('Expiry date cannot be before the issue date.');
  });
});
