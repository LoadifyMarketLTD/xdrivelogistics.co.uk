import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const freightVision = readFileSync(resolve(process.cwd(), 'app/admin/freight-vision/page.tsx'), 'utf8');
const liveAvailability = readFileSync(resolve(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');
const operationsDiary = readFileSync(resolve(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const returnJourneys = readFileSync(resolve(process.cwd(), 'app/admin/fleet/returns/page.tsx'), 'utf8');
const nearbyApi = readFileSync(resolve(process.cwd(), 'app/api/availability/nearby/route.ts'), 'utf8');

describe('CX operational gaps closed in the XDrive workspace language', () => {
  it('distinguishes not-started work from execution that started but stopped tracking', () => {
    expect(freightVision).toContain("type TrackingState = 'on_time' | 'behind_eta' | 'late' | 'not_tracking' | 'not_started'");
    expect(freightVision).toContain("not_started: 'Not started'");
    expect(freightVision).toContain('<KpiCard label="Not started"');
    expect(freightVision).toContain('<option value="not_started">Not started</option>');
    expect(freightVision).toContain("if (!pickupStarted)");
    expect(freightVision).toContain("return 'not_started'");
  });

  it('exposes privacy-scoped nearby exchange vehicles without revealing other-company driver identity', () => {
    expect(liveAvailability).toContain('Nearby Exchange');
    expect(liveAvailability).toContain('/api/availability/nearby');
    expect(liveAvailability).toContain('pallets_capacity');
    expect(liveAvailability).toContain('has_tail_lift');
    expect(nearbyApi).toContain("scope: 'exchange'");
    expect(nearbyApi).toContain('lat: Number(row.exchange_lat)');
    expect(nearbyApi).toContain('lng: Number(row.exchange_lng)');
    expect(nearbyApi).not.toContain("scope: 'exchange',\n      driver_id");
  });

  it('keeps admin Diary scan-expand-act parity with an Expand all control', () => {
    expect(operationsDiary).toContain('allVisibleExpanded');
    expect(operationsDiary).toContain('toggleExpandAll');
    expect(operationsDiary).toContain("'Expand all'");
    expect(operationsDiary).toContain("'Collapse all'");
    expect(operationsDiary).toContain('expandedIds.has(job.id)');
  });

  it('enriches Return Journeys with existing notes/location data while retaining schema compatibility', () => {
    expect(returnJourneys).toContain('notes?: string | null');
    expect(returnJourneys).toContain('Latest position');
    expect(returnJourneys).toContain('Call driver');
    expect(returnJourneys).toContain('isMissingColumnError');
    expect(returnJourneys).toContain("'return_journeys', 'notes'");
  });

  it('does not introduce super-admin coupling in the new operational surfaces', () => {
    for (const source of [freightVision, liveAvailability, operationsDiary, returnJourneys]) {
      expect(source).not.toContain('/super-admin');
    }
  });
});
