import fs from 'node:fs';
import path from 'node:path';

const api = fs.readFileSync(path.join(process.cwd(), 'app/api/marketplace/company/route.ts'), 'utf8');
const ui = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('CX Loads confirmed commercial-detail parity', () => {
  it('projects only existing commercial/load metadata from the marketplace API', () => {
    expect(api).toContain("'payment_terms', 'hard_copy_pod'");
    expect(api).toContain('payment_terms: marketplaceText(row.payment_terms)');
    expect(api).toContain('hard_copy_pod: marketplaceText(row.hard_copy_pod)');
    expect(api).toContain('posterPhone: company?.phone ?? null');
  });

  it('surfaces poster phone, payment terms and hard-copy POD on XDrive load cards', () => {
    expect(ui).toContain('posterPhone: string | null');
    expect(ui).toContain("href={`tel:${load.posterPhone.replace(/\\s+/g, '')}`}");
    expect(ui).toContain('Payment terms: ${load.payment_terms}');
    expect(ui).toContain('Hard-copy POD: ${load.hard_copy_pod}');
  });

  it('does not invent electronic-quote suppression before CX semantics are confirmed', () => {
    expect(api).not.toContain('electronic_quotes_disabled');
    expect(ui).not.toContain('Call only');
  });
});
