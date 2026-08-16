import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isCarrierAttentionJob } from '../app/components/workspace/CarrierOperationsDashboardHome';
import {
  getWorkspaceJobSelect,
  type WorkspaceJob,
} from '../app/components/workspace/useCompanyWorkspaceData';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const page = (path: string) => resolve(process.cwd(), 'app', path.replace(/^\//, ''), 'page.tsx');

const carrierJob = (overrides: Partial<WorkspaceJob> = {}): WorkspaceJob => ({
  id: 'job-1',
  company_id: 'customer-company',
  status: 'posted',
  current_status: 'posted',
  pickup_location: 'Blackburn',
  delivery_location: 'Manchester',
  pickup_datetime: '2026-08-16T09:00:00.000Z',
  delivery_datetime: '2026-08-16T11:00:00.000Z',
  vehicle_type: 'luton_van',
  assigned_driver_id: null,
  awarded_carrier_company_id: 'carrier-company',
  delivery_photos: [],
  created_at: '2026-08-15T09:00:00.000Z',
  updated_at: '2026-08-15T09:00:00.000Z',
  ...overrides,
});

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

  it('keeps cancelled work out of actionable attention while preserving real blockers', () => {
    expect(isCarrierAttentionJob(carrierJob({
      status: 'cancelled',
      current_status: 'cancelled',
    }))).toBe(false);

    expect(isCarrierAttentionJob(carrierJob({
      status: 'failed',
      current_status: 'delivery_failed',
      assigned_driver_id: 'driver-1',
    }))).toBe(true);

    expect(isCarrierAttentionJob(carrierJob({
      status: 'awarded',
      current_status: 'awarded',
      assigned_driver_id: null,
    }))).toBe(true);
  });

  it('backs every carrier dashboard action with a real route', () => {
    for (const href of [
      '/admin/marketplace',
      '/admin/diary',
      '/admin/jobs',
      '/admin/fleet/positions',
      '/admin/live-availability',
      '/admin/fleet/vehicles',
      '/admin/fleet/compliance',
      '/admin/fleet/assignments',
      '/admin/fleet/active-jobs',
      '/admin/invoices',
    ]) {
      expect(existsSync(page(href)), `${href} has no page.tsx`).toBe(true);
    }
    expect(existsSync(page('/admin/jobs/[id]'))).toBe(true);
  });

  it('keeps carrier commercial links, award truth, and lifecycle labels canonical', () => {
    const carrier = source('app/components/workspace/CarrierOperationsDashboardHome.tsx');

    expect(carrier).toContain("const awardedJobIds = new Set(carrierExecutionJobs.map((job) => job.id));");
    expect(carrier).toContain("normalise(bid.status) === 'accepted' && awardedJobIds.has(bid.job_id)");
    expect(carrier).toContain("metricValue(data, ['bids', 'jobs']");
    expect(carrier).toContain("router.push('/admin/marketplace')");
    expect(carrier).toContain("router.push('/admin/live-availability')");
    expect(carrier).not.toContain("['submitted', 'pending']");
    expect(carrier).toContain("normalise(bid.status) === 'submitted'");
    expect(carrier).toContain("XDrive persists that driver's canonical active vehicle with the allocation");
    expect(carrier).toContain("'Required vehicle'");
    expect(carrier).toContain("jobStatus(job) === 'cancelled' ? 'grey'");
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
