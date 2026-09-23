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

  it('uses XDrive IDs in member profiles and bidder decision identity', () => {
    const companyProfile = read('app/api/member-profile/[companyId]/route.ts');
    const driverProfile = read('app/api/member-profile/driver/[driverId]/route.ts');
    const bidderIdentity = read('app/api/_lib/bidderDecisionIdentity.ts');

    expect(companyProfile).toContain(".select('id, name, xd_id, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, company_type, status, created_at')");
    expect(companyProfile).toContain('memberId: company.xd_id ?? null');
    expect(companyProfile).not.toContain('memberId: company.company_number');

    expect(driverProfile).toContain(".select('id, company_id, user_id, display_name, status, availability_status')");
    expect(driverProfile).toContain(".from('profiles')");
    expect(driverProfile).toContain(".select('xd_id')");
    expect(driverProfile).toContain('memberId: profileError ? null : profile?.xd_id ?? null');

    expect(bidderIdentity).toContain("select('id, name, xd_id, phone, company_type')");
    expect(bidderIdentity).toContain('memberId: text(company?.xd_id)');
    expect(bidderIdentity).not.toContain('memberId: text(company?.company_number)');
  });

  it('uses XDrive member IDs in the shared job sheet and member-facing labels', () => {
    const jobSheet = read('app/api/workspace/jobs/[jobId]/sheet/route.ts');
    const companyJobSheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');
    const driverJobSheet = read('app/components/workspace/DriverJobSheetPanel.tsx');

    expect(jobSheet).toContain("select('id, name, xd_id, phone, company_type')");
    expect(jobSheet).toContain('memberId: text(ownerCompany.xd_id)');
    expect(jobSheet).toContain('memberId: text(carrierCompany.xd_id)');
    expect(jobSheet).toContain('memberId: text(executionCompany.xd_id)');
    expect(jobSheet).not.toContain('memberId: text(ownerCompany.company_number)');

    expect(companyJobSheet).toContain('Member ID ${memberId}');
    expect(companyJobSheet).not.toContain('Company no. ${memberId}');
    expect(driverJobSheet).toContain('Member ID ${sheet.memberCode}');
  });

  it('labels Directory, Member Profile, Return Journeys and driver exchange views with XDrive member identity', () => {
    const directoryUi = read('app/components/workspace/MemberDirectoryPage.tsx');
    const memberProfileUi = read('app/components/workspace/MemberProfile.tsx');
    const returnsUi = read('app/driver/returns/page.tsx');
    const historyUi = read('app/driver/history/page.tsx');
    const nearbyUi = read('app/driver/nearby/page.tsx');
    const settingsUi = read('app/components/workspace/RoleSettingsWorkspace.tsx');

    expect(directoryUi).toContain('Member Name / ID');
    expect(directoryUi).toContain('Name or XD member ID');
    expect(directoryUi).toContain('Member ID ${company.memberId}');
    expect(directoryUi).not.toContain('Company no. ${company.memberId}');

    expect(memberProfileUi).toContain("const memberIdLabel = 'Member ID'");
    expect(memberProfileUi).toContain('[memberIdLabel, profile.member.memberId');
    expect(memberProfileUi).toContain('Member ID ${profile.member.memberId}');
    expect(memberProfileUi).not.toContain('Company no. ${profile.member.memberId}');

    expect(returnsUi).toContain('Member / Driver');
    expect(returnsUi).toContain('Member ID ${journey.member.code}');
    expect(returnsUi).not.toContain('Company no. ${journey.member.code}');

    expect(historyUi).toContain('Member ID ${sheet.memberCode}');
    expect(historyUi).not.toContain('Company no. ${sheet.memberCode}');
    expect(nearbyUi).toContain('Member ID ${position.member_code}');
    expect(nearbyUi).not.toContain('Company no. ${position.member_code}');

    expect(settingsUi).toContain("const identityCode = company?.xd_id || 'Not assigned'");
    expect(settingsUi).not.toContain('company?.xd_id || company?.company_number');
    expect(settingsUi).toContain('Registered company number');
  });
});