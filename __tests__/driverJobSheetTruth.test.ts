import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/driver/jobs/[jobId]/sheet/route.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'app/components/workspace/DriverJobSheetPanel.tsx'), 'utf8');

describe('Driver assigned job sheet truth', () => {
  it('does not substitute the driver current vehicle for missing persistent job allocation', () => {
    expect(route).toContain("source: vehicleId ? 'job' : 'none'");
    expect(route).not.toContain(".eq('assigned_driver_id', driver.driverId).order('created_at'");
    expect(panel).not.toContain("'driver_current'");
    expect(panel).toContain('No persistent job-level execution vehicle is recorded.');
  });

  it('enforces the platform-wide mandatory POD contract', () => {
    expect(route).toContain('const podRequired = true;');
    expect(panel).toContain('podRequired: boolean;');
    expect(panel).toContain('Digital POD is mandatory for every XDrive job.');
    expect(panel).not.toContain("sheet.podRequired == null ? 'Not supplied'");
  });

  it('does not use service-role enrichment to grant company invoice visibility to a driver', () => {
    expect(route).toContain('Driver assignment is not, by itself, an invoice visibility grant.');
    expect(route).toContain('const invoicePromise = Promise.resolve({ data: [], error: null });');
    expect(panel).toContain('Driver assignment does not grant company invoice visibility.');
  });

  it('keeps forklift availability distinct from a forklift requirement', () => {
    expect(route).toContain("'Forklift available'");
    expect(route).not.toContain("'Forklift available / required'");
  });
});
