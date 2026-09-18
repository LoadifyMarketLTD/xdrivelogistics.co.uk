import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/customer/diary/page.tsx'), 'utf8');

describe('customer diary action semantics', () => {
  it('does not expose booking action before award', () => {
    expect(source).toContain("classifyWorkspaceJobStage(job) !== 'open' ? <ActionButton");
    expect(source).toContain('>Open booking</ActionButton> : null}');
  });
  it('keeps replay available for diary records', () => {
    expect(source).toContain('`/job-replay/${job.id}`');
  });
});
