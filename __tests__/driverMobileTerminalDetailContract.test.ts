import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/route.ts'),
  'utf8',
);
const types = fs.readFileSync(
  path.join(process.cwd(), 'apps/driver-mobile/src/jobs/types.ts'),
  'utf8',
);

describe('driver mobile terminal detail contract', () => {
  it('keeps Expo CanonicalJobStatus limited to executable/presentation lifecycle states', () => {
    expect(types).not.toContain("| 'cancelled'");
    expect(types).not.toContain("| 'disputed'");
    expect(types).not.toContain("| 'not_actionable'");
  });

  it('keeps detail reads assignment-gated before lifecycle presentation', () => {
    expect(route).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(route).toContain("const status = executionStatus(row)");
  });

  it('rejects terminal and unknown assignment states instead of mapping them to an actionable status', () => {
    expect(route).toContain("status === 'cancelled'");
    expect(route).toContain("status === 'disputed'");
    expect(route).toContain('actionable: false');
    expect(route).toContain('return respond(409');
    expect(route.indexOf('if (!detailReadableStatuses.has(status))')).toBeLessThan(route.indexOf('...mapJob(row)'));
  });
});
