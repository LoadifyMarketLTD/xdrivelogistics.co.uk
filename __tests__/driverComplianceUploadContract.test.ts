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

  test('keeps the database write server-mediated while storage remains RLS-bound', () => {
    expect(uploadRoute).toContain('requireWebDriver(request)');
    expect(uploadRoute).toContain(".from('driver_documents')");
    expect(uploadRoute).toContain('.insert({');
    expect(uploadRoute).toContain(".from('driver-docs')");
    expect(uploadRoute).toContain('.download(storagePath)');
    expect(documentsPage).toContain('supabase.storage');
    expect(documentsPage).toContain(".from('driver-docs')");
    expect(documentsPage).toContain('.upload(storagePath, file');
    expect(documentsPage).toContain("fetch('/api/driver/documents'");
    expect(documentsPage).not.toMatch(/supabase\.from\('driver_documents'\)\.insert/);
  });

  test('binds the storage path and record to the authenticated Driver', () => {
    expect(uploadRoute).toContain('const tenantAnchor = driver.companyId ?? driver.driverId;');
    expect(uploadRoute).toContain('const expectedPrefix = `${tenantAnchor}/${driver.driverId}/`;');
    expect(uploadRoute).toContain('storagePath.startsWith(expectedPrefix)');
    expect(uploadRoute).toContain('driver_id: driver.driverId');
    expect(documentsPage).toContain('const tenantAnchor = companyId ?? driverId;');
    expect(documentsPage).toContain('`${tenantAnchor}/${driverId}/${uploadId}.${extension}`');
  });

  test('is retry-safe and compensates invalid or failed persistence', () => {
    expect(uploadRoute).toContain(".eq('file_path', storagePath)");
    expect(uploadRoute).toContain('idempotent: true');
    expect(uploadRoute).toContain('removeStoredObject(storagePath)');
    expect(uploadRoute).toContain("status: 'pending'");
    expect(documentsPage).toContain('recoverPersistedRecord');
    expect(documentsPage).toContain("await supabase.storage.from('driver-docs').remove([storagePath]);");
  });

  test('validates the stored object before creating the record', () => {
    expect(uploadRoute).toContain('MAX_DOCUMENT_BYTES = 10 * 1024 * 1024');
    expect(uploadRoute).toContain('hasExpectedMagicBytes');
    expect(uploadRoute).toContain("Use a PDF, JPG, PNG or WEBP document.");
    expect(uploadRoute).toContain("Expiry date cannot be before the issue date.");
    expect(documentsPage).toContain('File must be 10 MB or smaller.');
  });

  test('retains real expired documents in the authenticated compliance register for audit', () => {
    expect(uploadRoute).toContain('export async function GET(request: NextRequest)');
    expect(uploadRoute).toContain(".eq('driver_id', driver.driverId)");
    expect(uploadRoute).toContain('expiry_date, status, rejection_reason, created_at');
    expect(uploadRoute).toContain('documents: data ?? []');
    expect(uploadRoute).not.toContain('purgeExpiredDriverDocuments');
    expect(documentsPage).toContain("fetch('/api/driver/documents'");
  });

  test('preserves replacement history instead of deleting authentic driver evidence', () => {
    expect(uploadRoute).toContain(".eq('file_path', storagePath)");
    expect(uploadRoute).toContain('idempotent: true');
    expect(uploadRoute).not.toContain('purgeReplacedDriverDocuments');
    expect(uploadRoute).toContain('replacedDeleted: 0');
  });
});
