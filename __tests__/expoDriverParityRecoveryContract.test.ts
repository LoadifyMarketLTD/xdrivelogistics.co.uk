import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Expo driver parity recovery contracts', () => {
  it('consumes privacy-safe market intelligence without rendering competitor coordinates', () => {
    const operations = read('apps/driver-mobile/src/api/operations.ts');
    const panel = read('apps/driver-mobile/src/live-loads/DriverAvailabilityPanel.tsx');

    expect(operations).toContain('/api/driver/mobile/market-intelligence?radius=');
    expect(operations).toContain('visible: boolean');
    expect(panel).toContain('market?.ppm.visible');
    expect(panel).toContain('privacy-safe competitor cluster');
    expect(panel).toContain('privacyMinimum');
    expect(panel).not.toContain('cluster.latitude');
    expect(panel).not.toContain('cluster.longitude');
  });

  it('loads the complete one-year completed-job window through cursor pagination', () => {
    const jobs = read('apps/driver-mobile/src/api/jobs.ts');

    expect(jobs).toContain("scope: 'completed'");
    expect(jobs).toContain("historyDays: '365'");
    expect(jobs).toContain("limit: '250'");
    expect(jobs).toContain("params.set('cursor', cursor)");
    expect(jobs).toContain('seenCursors.has(nextCursor)');
    expect(jobs).toContain("promptForPermissions: scope !== 'completed'");
  });
});
