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

  it('uses the posting user XDrive ID on the web driver marketplace', () => {
    const market = read('app/api/driver/marketplace/loads/route.ts');
    expect(market).toContain(".select('user_id, full_name, xd_id')");
    expect(market).toContain('const memberId = posterProfile?.xd_id ?? company?.xd_id ?? null');
    expect(market).not.toContain('memberId: company?.company_number');
  });

  it('uses company XDrive IDs on the carrier marketplace and never legal registration numbers', () => {
    const companyMarket = read('app/api/marketplace/company/route.ts');
    expect(companyMarket).toContain('companies!jobs_company_id_fkey(name,xd_id,phone,company_type,created_at)');
    expect(companyMarket).toContain('posterMemberCode: company?.xd_id ?? null');
    expect(companyMarket).not.toContain('company?.company_number');
    expect(companyMarket).not.toContain('companies!jobs_company_id_fkey(name,company_number');
  });

  it('uses company XDrive IDs in legacy web driver load search', () => {
    const search = read('app/api/driver/search-loads/route.ts');
    expect(search).toContain('companies!jobs_company_id_fkey(name,xd_id,phone,company_type,created_at)');
    expect(search).toContain('posterMemberCode: company?.xd_id ?? null');
    expect(search).not.toContain('company?.company_number');
  });

  it('uses XDrive member IDs on return journeys', () => {
    const returns = read('app/api/driver/return-journeys/route.ts');
    expect(returns).toContain(".select('id,name,xd_id,phone')");
    expect(returns).toContain('code: cleanText(company.xd_id, 80) || null');
    expect(returns).not.toContain('company.company_number');
  });

  it('shows XDrive member IDs, not Companies House numbers, in Post Load identity panels', () => {
    const posting = read('app/components/workspace/LoadPostingForm.tsx');
    expect(posting).toContain(".select('id, name, xd_id')");
    expect(posting).toContain(".select('id, name, xd_id, status')");
    expect(posting).toContain("memberId: typeof data?.xd_id === 'string' ? data.xd_id : null");
    expect(posting).toContain("memberId: typeof data.xd_id === 'string' ? data.xd_id : null");
    expect(posting).toContain('Member ID<div style={readOnlyStyle}>');
    expect(posting).not.toContain('Company number<div style={readOnlyStyle}>');
    expect(posting).not.toContain('data.company_number');
  });

  it('keeps legal company numbers separate from Directory member IDs', () => {
    const directory = read('app/api/directory/route.ts');
    const network = read('app/driver/network/page.tsx');
    expect(directory).toContain('memberId: company.xd_id ?? null');
    expect(network).toContain('Member ID ${company.xd_id}');
    expect(network).not.toContain('Member ID ${company.company_number}');
  });
});
