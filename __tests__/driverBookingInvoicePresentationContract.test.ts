import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../app/api/driver/mobile/jobs/[id]/route.ts', import.meta.url),
  'utf8',
);

describe('driver booking detail invoice presentation contract', () => {
  it('loads the latest invoice for the assigned driver company and returns it with the job', () => {
    expect(source).toContain(".from('invoices')");
    expect(source).toContain(".eq('job_id', id)");
    expect(source).toContain(".eq('company_id', driver.companyId)");
    expect(source).toContain('invoice: existingInvoice');
    expect(source).toContain('invoicePresentationPartial');
  });
});
