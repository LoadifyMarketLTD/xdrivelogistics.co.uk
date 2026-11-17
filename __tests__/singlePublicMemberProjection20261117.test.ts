import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src=(path:string)=>readFileSync(path,'utf8');

describe('One public commercial ID across XDrive directory, jobs and drivers',()=>{
  it('hides unverified personal workspaces including inactive Owner Driver duplicate shells',()=>{
    const directory=src('app/api/directory/route.ts');
    expect(directory).toContain("from('platform_identity_registry')");
    expect(directory).toContain(".eq('identity_mode', 'owner_driver')");
    expect(directory).toContain(".eq('status', 'active')");
    expect(directory).toContain("verifiedOwnerByCompany.get(String(company.id)) === String(company.created_by)");
    expect(directory).toContain("memberId: company.xd_id ?? null");
  });
  it('uses the employing company public ID on Company Driver directory cards',()=>{
    const directory=src('app/api/directory/route.ts');
    expect(directory).toContain('memberId: company?.memberId ?? null');
    expect(directory).not.toContain('memberIdByUserId.get(');
    expect(directory).not.toContain("from('profiles').select('user_id,xd_id')");
  });
  it('shows the company member ID rather than the posting staff user ID on assigned jobs',()=>{
    for(const channel of ['mobile','web']){
      const list=src('app/api/driver/'+channel+'/jobs/route.ts');
      const detail=src('app/api/driver/'+channel+'/jobs/[id]/route.ts');
      expect(list).toContain('companyXdId: row.company_id ? ownerCompany?.xd_id ?? undefined : posterMemberId ?? undefined');
      expect(detail).toContain('companyXdId: row.company_id ? ownerCompany?.xd_id ?? undefined : posterMemberId ?? undefined');
    }
  });
  it('shows one company ID on the driver-facing job sheet',()=>{
    const sheet=src('app/api/driver/jobs/[jobId]/sheet/route.ts');
    expect(sheet).toContain('memberCode: originCompanyId ? text(company.xd_id) : text(posterProfile.xd_id)');
  });
  it('never shows a personal profile ID for a company-employed driver in member profile',()=>{
    const driver=src('app/api/member-profile/driver/[driverId]/route.ts');
    expect(driver).toContain('memberId: companyPublicId');
    expect(driver).toContain("memberType: driverType === 'owner_driver' ? 'Owner Driver' : 'Company Driver'");
    expect(driver).toContain('companyPublicId !== personalPublicId');
    expect(driver).toContain("driver.driver_type === 'owner_driver' && driver.user_id");
    expect(driver).not.toContain('memberId: profileError ? null : profile?.xd_id');
  });
});
