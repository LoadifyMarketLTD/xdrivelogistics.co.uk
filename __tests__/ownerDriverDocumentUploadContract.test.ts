import fs from 'node:fs';
import path from 'node:path';

describe('Owner Driver document remediation contract', () => {
  const documentsApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/documents/route.ts'),
    'utf8',
  );
  const documentsPage = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/documents/page.tsx'),
    'utf8',
  );
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

  test('routes browser document writes through a server-authoritative endpoint', () => {
    expect(documentsPage).toContain("fetch('/api/driver/documents'");
    expect(documentsPage).not.toContain("storage.from('driver-docs').upload");
    expect(documentsPage).not.toContain("from('driver_documents').insert");
    expect(documentsApi).toContain("storage.from('driver-docs').upload");
    expect(documentsApi).toContain("from('driver_documents').insert");
    expect(documentsApi).toContain("from('vehicle_documents').insert");
    expect(documentsApi).toContain('await cleanup();');
  });

  test('keeps remediation possible before app_access without opening commercial routes', () => {
    expect(roleCapabilities).toContain("path === '/driver/documents'");
    expect(roleCapabilities).toContain("path === '/driver/vehicles'");
    expect(roleCapabilities).toContain('!isComplianceRemediationRoute && context.appAccess !== true');
    expect(roleCapabilities).toContain('isDriverCommercialRoute(path)');
    expect(documentsApi).not.toContain('app_access !== true');
    expect(documentsApi).toContain("driverStatus !== 'active'");
    expect(documentsApi).toContain("membership?.status !== 'active'");
  });

  test('separates Driver and Vehicle documents and binds vehicle evidence to an authorised vehicle', () => {
    expect(documentsPage).toContain('Driver document');
    expect(documentsPage).toContain('Vehicle document');
    expect(documentsPage).toContain("'MOT', 'Insurance', 'Goods Vehicle Test', 'Other'");
    expect(documentsApi).toContain("scope !== 'driver' && scope !== 'vehicle'");
    expect(documentsApi).toContain(".eq('company_id', context.companyId)");
    expect(documentsApi).toContain('vehicle.assigned_driver_id !== context.driverId');
  });

  test('provides an explicit same-company Assign to me flow without silent reassignment', () => {
    expect(vehiclesApi).toContain("action: z.literal('assign_to_me')");
    expect(vehiclesApi).toContain('This vehicle is already assigned to another Driver.');
    expect(vehiclesApi).toContain('You already have an active assigned vehicle');
    expect(vehiclesApi).toContain(".is('assigned_driver_id', null)");
    expect(vehiclesPage).toContain('Assign to me');
    expect(vehiclesPage).toContain("action: 'assign_to_me'");
  });

  test('aligns WEBP with the private 10 MB driver-docs contract and never deletes orphan objects', () => {
    expect(documentsPage).toContain('image/webp');
    expect(documentsApi).toContain("'image/webp'");
    expect(migration).toContain("'image/webp'");
    expect(migration).toContain("WHERE id = 'driver-docs'");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+storage\.objects/i);
  });

  test('normalises only provable legacy signed paths and generates fresh signed readback', () => {
    expect(migration).toContain('/storage/v1/object/sign/driver-docs/');
    expect(migration).toContain("o.bucket_id = 'driver-docs'");
    expect(migration).toContain('o.name = c.object_path');
    expect(documentsApi).toContain('normalizeDriverDocsObjectPath');
    expect(documentsApi).toContain("createSignedUrl(objectPath, 3600)");
    expect(documentsPage).toContain('doc.signed_url');
  });
});
