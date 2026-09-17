import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/customer/CustomerOperationalPages.tsx'), 'utf8');

describe('customer loads action semantics', () => {
  it('does not label an open unawarded load as a booking', () => {
    expect(source).toContain("classifyWorkspaceJobStage(job) !== 'open' ? 'Open booking' : undefined");
    expect(source).toContain("actionHref?: string");
    expect(source).toContain('actionLabel && actionHref ?');
  });

  it('keeps submitted unawarded quotes directly reviewable', () => {
    expect(source).toContain("quoteState.submitted > 0 && !job.awarded_carrier_company_id ? 'Review quotes'");
    expect(source).toContain("quoteState.submitted > 0 && !job.awarded_carrier_company_id ? '/customer/quotes'");
  });
});
