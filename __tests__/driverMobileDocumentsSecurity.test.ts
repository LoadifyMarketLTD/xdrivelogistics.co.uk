import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('driver mobile document boundary', () => {
  it('requires driver ownership before issuing a short-lived signed document URL', () => {
    const route = source('app/api/driver/mobile/documents/[id]/route.ts');
    expect(route).toContain('requireDriver(request)');
    expect(route).toContain(".eq('driver_id', driver.driverId)");
    expect(route).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(route).toContain("createSignedUrl(storagePath, 300)");
    expect(route).toContain("'Cache-Control': 'no-store, max-age=0'");
  });

  it('persists real issue/expiry dates and exposes complete server metadata', () => {
    const resources = source('app/api/driver/mobile/resources/route.ts');
    expect(resources).toContain('issued_date,expiry_date,rejection_reason,risk_status,verified_at');
    expect(resources).toContain('issued_date: issuedDate || null');
    expect(resources).toContain('expiry_date: expiryDate || null');
    expect(resources).toContain("select('id,name,xd_id,company_number,company_type,status')");
  });
});
