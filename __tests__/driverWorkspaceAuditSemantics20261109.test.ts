import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const job = readFileSync(join(process.cwd(), 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
const loads = readFileSync(join(process.cwd(), 'app/driver/loads/page.tsx'), 'utf8');

describe('Driver workspace accessibility and semantic contracts', () => {
  it('labels the actual recipient signature canvas in booking delivery evidence', () => {
    expect(job).toContain('htmlFor="driver-pod-recipient-signature"');
    expect(job).toContain('id="driver-pod-recipient-signature"');
    expect(job).toContain('Recipient signature (required)');
    expect(job).toContain('Recipient signature is required to complete POD.');
  });
  it('does not advertise unsupported geographic radius filtering as active', () => {
    expect(loads).toContain('From (town / postcode)');
    expect(loads).not.toContain('<span className="label">From / Radius</span>');
  });
  it('projects public load details into Quote Now rather than displaying false TBC fields', () => {
    const modal = readFileSync(join(process.cwd(), 'app/driver/_components/MarketplaceQuoteModal.tsx'), 'utf8');
    expect(loads).toContain('paymentTerms: load.payment_terms');
    expect(loads).toContain('pickupAt: load.pickup_datetime');
    expect(loads).toContain('dimensions: dimensions(load)');
    expect(modal).toContain('pickupDate: target.pickupAt');
    expect(modal).toContain('paymentTerms: target.paymentTerms');
  });
  it('still retains Quote Now and authorised backend-only quote submission', () => {
    expect(loads).toContain("fetch('/api/driver/bids'");
    expect(loads).toContain('MarketplaceQuoteModal');
  });
});
