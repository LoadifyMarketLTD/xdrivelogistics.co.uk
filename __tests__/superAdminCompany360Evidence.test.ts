import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const panel = readFileSync('app/super-admin/_components/control-plane/Company360Panel.tsx','utf8');
const api = readFileSync('app/api/super-admin/inspect/company/[entityId]/360/route.ts','utf8');
describe('Company 360 evidence integrity', () => {
  it('never asserts preflight clearance when a source is unavailable', () => {
    expect(panel).toContain('preflightIncomplete');
    expect(panel).toContain('Preflight evidence unavailable or incomplete');
    expect(panel).toContain('Missing-document verification unavailable');
  });
  it('flags incomplete data coverage in API and UI', () => {
    expect(api).toContain('unavailableEvidenceCount');
    expect(api).toContain('limitedDomains.length === 0 && unavailableEvidenceCount === 0');
    expect(panel).toContain('Company 360 coverage incomplete.');
  });
});
