import fs from 'node:fs';
import path from 'node:path';

describe('Driver compliance upload contract', () => {
  const uploadRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/documents/route.ts'),
    'utf8',
  );
  const documentsPage = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/documents/page.tsx'),
    'utf8',
  );

  test('keeps compliance writes server-mediated instead of granting browser table writes', () => {
    expect(uploadRoute).toContain('requireWebDriver(request)');
    expect(uploadRoute).toContain("supabaseAdmin.storage\n    .from('driver-docs')");
    expect(uploadRoute).toContain(".from('driver_documents')");
    expect(uploadRoute).toContain('.insert({');
    expect(documentsPage).toContain("fetch('/api/driver/documents'");
    expect(documentsPage).not.toMatch(/supabase\.from\('driver_documents'\)\.insert/);
    expect(documentsPage).not.toMatch(/supabase\.storage\.from\('driver-docs'\)\.upload/);
  });

  test('binds uploaded records to the authenticated Driver and preserves cleanup', () => {
    expect(uploadRoute).toContain('driver_id: driver.driverId');
    expect(uploadRoute).toContain('const tenantAnchor = driver.companyId ?? driver.driverId;');
    expect(uploadRoute).toContain('`${tenantAnchor}/${driver.driverId}/${randomUUID()}.${extension}`');
    expect(uploadRoute).toContain("await supabaseAdmin.storage.from('driver-docs').remove([storagePath]);");
    expect(uploadRoute).toContain("status: 'pending'");
  });

  test('validates size, MIME magic bytes and date ordering before persistence', () => {
    expect(uploadRoute).toContain('MAX_DOCUMENT_BYTES = 10 * 1024 * 1024');
    expect(uploadRoute).toContain('hasExpectedMagicBytes');
    expect(uploadRoute).toContain("Use a PDF, JPG, PNG or WEBP document.");
    expect(uploadRoute).toContain("Expiry date cannot be before the issue date.");
  });
});
