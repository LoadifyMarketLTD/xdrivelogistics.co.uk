import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Directory CX parity contract', () => {
  const directory = read('app/components/workspace/MemberDirectoryPage.tsx');
  const css = read('app/components/workspace/workspace-measured-cx-baseline.css');

  it('uses one shared Directory component across all operational route families', () => {
    for (const route of [
      'app/admin/marketplace/directory/page.tsx',
      'app/broker/carrier-network/directory/page.tsx',
      'app/customer/network/directory/page.tsx',
      'app/driver/directory/page.tsx',
    ]) {
      const source = read(route);
      expect(source).toContain('<MemberDirectoryPage />');
      expect(source).not.toContain('<PageHeader');
    }
    expect(directory).not.toContain("if (pathname.startsWith('/driver')) {");
  });

  it('keeps the CX-style search order and nearest-search controls', () => {
    const order = [
      'Find My Nearest',
      'COUNTRY',
      'MEMBER NAME / ID',
      'LOCATION',
      'NEAREST POSTCODE',
      'RADIUS SEARCH',
      'VEHICLE SIZE / TYPE',
      'Minimum',
      'Exact',
      'MEMBER TYPE',
      'SPECIALIST SERVICE',
      'Tail Lift',
      'DELIVERY RELIABILITY',
      'PAYMENT RELIABILITY',
      'AVAILABILITY',
      'Search',
      'Clear',
    ];
    let cursor = -1;
    for (const token of order) {
      const next = directory.indexOf(token, cursor + 1);
      expect(next, token).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it('supports truth-derived minimum/exact vehicle filtering without fake records', () => {
    expect(directory).toContain("vehicleMatchMode");
    expect(directory).toContain("VEHICLE_RANK");
    expect(directory).toContain("vehicleMatches(company.vehicleTypes ?? [], vehicleNeedle, vehicleMatchMode)");
    expect(directory).toContain("vehicleMatches([driver.vehicleType], vehicleNeedle, vehicleMatchMode)");
  });

  it('separates companies and drivers and provides shared pagination controls', () => {
    expect(directory).toContain('<strong>COMPANIES</strong>');
    expect(directory).toContain('<strong>DRIVERS</strong>');
    expect(directory).toContain('Items per Page');
    expect(directory).toContain('Previous');
    expect(directory).toContain('Next');
    expect(directory).toContain('safeDirectoryPage');
    expect(directory).toContain('sortedCompanies.slice(pageStart, pageStart + directoryPageSize)');
    expect(directory).toContain('sortedDrivers.slice(pageStart, pageStart + directoryPageSize)');
    expect(directory).toContain('displayedCompanies.map');
    expect(directory).toContain('displayedDrivers.map');
  });

  it('enforces the approved readable Directory typography', () => {
    expect(css).toContain('.xdrive-workspace-measured .xdrive-directory-page');
    expect(css).toContain('font-size: 14px !important;');
    expect(css).toContain('font-size: 16px !important;');
    expect(css).toContain('.xdrive-directory-layout');
    expect(css).toContain('grid-template-columns: 165px minmax(0, 1fr) !important;');
  });
});
