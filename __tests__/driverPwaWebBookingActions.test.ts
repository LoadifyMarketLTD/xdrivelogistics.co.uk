import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { undoWebDriverStatus } from '../app/api/driver/web/jobs/[id]/webUndoStatus';
import { scopedStopEvidenceObject, updateWebDriverStop } from '../app/api/driver/web/jobs/[id]/webStopStatus';

const context = { userId: 'user-1', driverId: 'driver-1', companyId: 'company-1' };
const makeRequest = (body: unknown) => new NextRequest('https://xdrivelogistics.co.uk/api/driver/web/jobs/job-1/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('Driver PWA real booking action routes', () => {
  it('dispatches undo and multi-drop updates after the web driver auth boundary', () => {
    const route = readFileSync('app/api/driver/web/jobs/[id]/[action]/route.ts', 'utf8');
    expect(route).toContain('requireActiveWebDriver(request)');
    expect(route).toContain("if (action === 'stop-status') return updateWebDriverStop(request, id, driver)");
    expect(route).toContain("if (action === 'undo-status') return undoWebDriverStatus(request, id, driver)");
    expect(route.indexOf('requireActiveWebDriver(request)')).toBeLessThan(route.indexOf("if (action === 'stop-status')"));
  });

  it('does not allow undo without the status snapshot used for concurrency protection', async () => {
    const response = await undoWebDriverStatus(makeRequest({}), 'job-1', context);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/status is required/i);
  });

  it('rejects malformed multi-drop mutations before touching database records', async () => {
    const missingId = await updateWebDriverStop(makeRequest({ status: 'arrived' }), 'job-1', context);
    expect(missingId.status).toBe(400);
    const invalidAction = await updateWebDriverStop(makeRequest({ stop_id: 'stop-1', status: 'skipped' }), 'job-1', context);
    expect(invalidAction.status).toBe(400);
  });

  it('accepts only exact uploaded object names in the assigned stop folder', () => {
    const prefix = 'company-1/job-1/stops/stop-1/photos/';
    expect(scopedStopEvidenceObject(prefix + 'collection.png', prefix)).toEqual({
      folder: 'company-1/job-1/stops/stop-1/photos', fileName: 'collection.png',
    });
    expect(scopedStopEvidenceObject(prefix, prefix)).toBeNull();
    expect(scopedStopEvidenceObject('other-company/job-1/stops/stop-1/photos/photo.jpg', prefix)).toBeNull();
    expect(scopedStopEvidenceObject(prefix + '../other.jpg', prefix)).toBeNull();
    expect(scopedStopEvidenceObject(prefix + 'https://external.invalid/photo.jpg', prefix)).toBeNull();
  });

  it('enforces assignment, persistent evidence and compare-and-set on web booking mutations', () => {
    const stop = readFileSync('app/api/driver/web/jobs/[id]/webStopStatus.ts', 'utf8');
    const undo = readFileSync('app/api/driver/web/jobs/[id]/webUndoStatus.ts', 'utf8');
    expect(stop).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(stop).toContain("target.stop_type === 'collection' && !handover");
    expect(stop).toContain('verifyStopEvidence');
    expect(stop).toContain(".eq('status', expected)");
    expect(undo).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(undo).toContain("mutation.eq('current_status', rawCurrent)");
    expect(undo).toContain('driver_web_undo');
  });
});
