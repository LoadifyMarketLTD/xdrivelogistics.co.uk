import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('XDrive member identity contract', () => {
  it('uses registration-time XDrive IDs on mobile load cards, never Companies House numbers', () => {
    const nearby = read('app/api/driver/mobile/nearby-jobs/route.ts');
    expect(nearby).toContain(".from('profiles').select('user_id,xd_id')");
    expect(nearby).toContain('memberCode: posterMemberId ?? company?.xd_id ?? null');
    expect(nearby).not.toContain('memberCode: company?.company_number');
  });

  it('uses the posting user XDrive ID on the web marketplace', () => {
    const market = read('app/api/driver/marketplace/loads/route.ts');
    expect(market).toContain(".select('user_id, full_name, xd_id')");
    expect(market).toContain('const memberId = posterProfile?.xd_id ?? company?.xd_id ?? null');
    expect(market).not.toContain('memberId: company?.company_number');
  });

  it('keeps legal company numbers separate from Directory member IDs', () => {
    const directory = read('app/api/directory/route.ts');
    const network = read('app/driver/network/page.tsx');
    expect(directory).toContain('memberId: company.xd_id ?? null');
    expect(network).toContain('Member ID ${company.xd_id}');
    expect(network).not.toContain('Member ID ${company.company_number}');
  });
});
