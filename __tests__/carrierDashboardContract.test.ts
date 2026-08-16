import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getWorkspaceJobSelect } from '../app/components/workspace/useCompanyWorkspaceData';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('carrier dashboard convergence contract', () => {
  it('keeps the carrier control desk independent of execution-only schema columns', () => {
    const carrierSelect = getWorkspaceJobSelect('carrier_operations');

    expect(carrierSelect).toContain('assigned_driver_id');
    expect(carrierSelect).toContain('awarded_carrier_company_id');
    expect(carrierSelect).toContain('delivery_photos');
    expect(carrierSelect).not.toContain('vehicle_id');
    expect(carrierSelect).not.toContain('booking_reference');
    expect(carrierSelect).not.toContain('customer_reference');
  });

  it('preserves persistent vehicle allocation on execution surfaces', () => {
    expect(getWorkspaceJobSelect('fleet')).toContain('vehicle_id');
    expect(getWorkspaceJobSelect('dispatcher')).toContain('vehicle_id');
    expect(getWorkspaceJobSelect('driver')).toContain('vehicle_id');
  });

  it('keeps carrier commercial links and lifecycle labels canonical', () => {
    const carrier = source('app/components/workspace/CarrierOperationsDashboardHome.tsx');

    expect(carrier).toContain('onClick={() => router.push(\'/admin/quotes\')}');
    expect(carrier).not.toContain("['submitted', 'pending']");
    expect(carrier).toContain("normalise(bid.status) === 'submitted'");
    expect(carrier).toContain("XDrive persists that driver's canonical active vehicle with the allocation");
    expect(carrier).not.toContain('vehicle planning remains advisory');
  });

  it('keeps one carrier Fleet group, restores workspace context, and resolves nested nav specifically', () => {
    const shell = source('app/components/workspace/TopWorkspaceShell.tsx');

    expect(shell).toContain("base.find((group) => group.id === 'carrier-fleet')");
    expect(shell).toContain("id: 'carrier-freight-vision'");
    expect(shell).toContain("import SharedContextControls from './SharedContextControls';");
    expect(shell).toContain('<SharedContextControls navigation={navigationTargets} />');
    expect(shell).toContain('.sort((a, b) => b.length - a.length)');
  });
});
