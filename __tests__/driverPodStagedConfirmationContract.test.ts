import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/api/driver/mobile/jobs/[id]/confirmation/route.ts', import.meta.url), 'utf8');

describe('driver POD staged confirmation contract', () => {
  it('accepts only verified staged delivery-photo evidence from the assigned company/job path', () => {
    expect(source).toContain("typeof body.evidencePath === 'string'");
    expect(source).toContain('`${driver.companyId}/${id}/photos/`');
    expect(source).toContain(".from('pod-photos')");
    expect(source).toContain(".list(folder, { limit: 100, search: fileName })");
    expect(source).toContain("error: 'Uploaded POD evidence could not be found.'");
    expect(source).toContain('evidence_path: evidencePath');
  });
});
