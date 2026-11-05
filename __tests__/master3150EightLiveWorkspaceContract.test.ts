import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {masterNavigationHref} from '../lib/masterWorkspaceNavigation';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const exists=(path:string)=>existsSync(fileURLToPath(new URL('../'+path,import.meta.url)));

describe('approved 3150 eight sections: authenticated Master, real data only',()=>{
  const roles=['Company / Carrier','Customer','Broker','Fleet','Owner Driver','Dispatcher'] as const;
  it('locks the approved 3150 visual CSS against accidental changes',()=>{
    const locked={
      'app/components/workspace/master3150-design-system.css':'1e10ea40149cc12243dec54dcc2f562362b6006d3eab9ed27711d16ab0968602',
      'app/components/workspace/master3150-operations-shell.css':'a2f77a4c32604d31d98339673c69f4fac31621fe59ac977167024c77a97eb29b',
      'app/components/workspace/master3150-record-card.css':'fa108db00dec264268798209502bf4981fd5937e25c01cb1f2e7856aa21a5c36',
      'app/components/workspace/master3150-admin-loads.css':'7064b28cdc8f3509a7034adcba9ccb38bad9e7f89814296c132a5c72b1b4ac2f',
      'app/components/workspace/master3150-quotes.css':'418acf3ff8698de0aa1259a32a598c7724da001d7d143e172a68ddc4eadb7bad',
      'app/try-xdrive-demo/components/demo-fleet-board.css':'830f8af8f8166d0d05928b03e8289b3363edd004623498d09000ecbba7623765',
      'app/try-xdrive-demo/components/demo-drivers-board.css':'9e31132d78fd69e962d55b6acc69e1f7ae2821cf735dcc1a2123a39dd666c49b',
      'app/components/workspace/approved-post-load-3150.css':'afd2ca35a58b91b9b6958527d19ea3d4803c9bb930311f3bf7e7aca97eda8ca5',
    };
    for(const [path,hash] of Object.entries(locked)){
      const actual=createHash('sha256').update(read(path)).digest('hex');
      expect(actual,path+' changed without updating the approved visual baseline').toBe(hash);
    }
  });
  it('keeps 3150 presentation styles in the shared authenticated shell',()=>{
    const shell=read('app/components/workspace/AuthenticatedMasterShell.tsx');
    for(const file of ['./master3150-production.css','./master3150-design-system.css','./master3150-operations-shell.css','./master3150-board-reference.css']){
      expect(shell,file).toContain(file);
    }
    expect(shell).toContain('ApprovedSidebar');
    expect(shell).toContain('MasterLogoutButton');
  });
  it('provides real functional routes for every authorized one of the eight tabs',()=>{
    for(const role of roles) for(const tab of [0,1,2,3,4,5,6,7]){
      const route=masterNavigationHref(role,tab);
      if(route===null)continue; // RBAC: Company Driver does not post or manage fleet.
      expect(exists('app'+route+'/page.tsx'),role+' tab '+tab+' missing '+route).toBe(true);
    }
  });
  it('retains one true Post Load form and authenticated creation endpoint across posters',()=>{
    const form=read('app/components/workspace/LoadPostingForm.tsx');
    const api=read('app/api/jobs/create/route.ts');
    expect(form).toContain("fetch('/api/jobs/create'");
    expect(form).toContain('PostcodeAddressField');
    expect(form).toContain('WorkspaceRestrictionBanner');
    expect(api).toContain('supabase');
    expect(form).not.toContain('publishDemoLoad');
    for(const page of ['app/admin/post-load/page.tsx','app/broker/post-load/page.tsx','app/driver/post-load/page.tsx'])
      expect(read(page)).toContain('LoadPostingForm');
    expect(read('app/customer/CustomerWorkspaceModules.tsx')).toContain('LoadPostingForm');
  });
  it('shares approved 3150 Loads, Quotes and Diary cards without simulated records',()=>{
    const load=read('app/components/workspace/CxLoadCard.tsx');
    const quote=read('app/components/workspace/CxQuoteCard.tsx');
    const diary=read('app/components/workspace/CxDiaryCard.tsx');
    for(const source of [load,quote,diary]) expect(source).toContain('Master3150Card');
    const renderer=read('app/components/workspace/Master3150Card.tsx');
    expect(renderer).toContain('data-master-reference="3150"');
    expect(renderer).toContain('{footer}');
    expect(renderer).not.toContain('fakeJob');
    expect(renderer).not.toContain('sampleBid');
  });
  it('renders Fleet and Drivers as 3150 layout with authenticated, own-company data',()=>{
    const member=read('app/components/workspace/MemberFleetOverview.tsx');
    const display=read('app/components/workspace/Master3150RealFleetBoard.tsx');
    const api=read('app/api/workspace/fleet-overview/route.ts');
    expect(member).toContain('/api/workspace/fleet-overview');
    expect(member).toContain('Master3150RealFleetBoard');
    expect(display).toContain('data-master-fleet="3150-real"');
    expect(display).toContain('data-master-drivers="3150-real"');
    expect(display).toContain("['Compliant','Unavailable'");
    expect(api).toContain("eq('user_id', auth.user.id)");
    expect(api).toContain("eq('company_id', companyId)");
    expect(api).toContain("eq('status', 'active')");
    expect(api).not.toContain('phone,');
    expect(api).not.toContain('email,');
    for(const path of [
      'app/admin/fleet/page.tsx','app/admin/drivers/page.tsx',
      'app/customer/fleet/page.tsx','app/customer/drivers/page.tsx',
      'app/broker/fleet/page.tsx','app/broker/drivers/page.tsx',
      'app/driver/fleet/page.tsx','app/driver/drivers/page.tsx',
    ]) expect(read(path)).toContain('MemberFleetOverview');
  });
  it('preserves real management features and does not turn admin pages into dead ends',()=>{
    expect(exists('app/admin/drivers/manage/page.tsx')).toBe(true);
    expect(read('app/admin/drivers/LegacyDriversManagement.tsx')).toContain('handleCreate');
    expect(read('app/admin/drivers/LegacyDriversManagement.tsx')).toContain('handleUpdate');
    expect(read('app/admin/fleet/page.tsx')).toContain('manageHref="/admin/fleet/vehicles"');
    expect(read('app/admin/drivers/page.tsx')).toContain('manageHref="/admin/drivers/manage"');
  });
  it('keeps published Bookings and the 9-state operational Diary backed by real data',()=>{
    expect(read('app/admin/won-work/page.tsx')).toContain('Master3150BookingHeader');
    expect(read('app/broker/jobs/page.tsx')).toContain('useCompanyWorkspaceData');
    expect(read('app/components/workspace/OperationsDiaryPage.tsx')).toContain('getCanonicalDiaryTabs');
    expect(read('app/components/workspace/OperationsDiaryPage.tsx')).toContain('isOperatingCompanyJob');
    expect(read('app/try-xdrive-demo/components/MasterWorkspace.tsx')).toContain('<AuthenticatedMasterShell role={role}');
  });
});