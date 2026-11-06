import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read=(name:string)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const nav=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
const api=read('app/api/workspace/fleet-overview/route.ts');
const ui=read('app/components/workspace/MemberFleetOverview.tsx');

describe('live own-company Fleet and Drivers, no cross-tenant access',()=>{
  it('routes authenticated Master Fleet/Drivers to genuine pages',()=>{
    expect(nav).toContain('if(authenticated && i===5)');
    expect(nav).toContain("role==='Customer'?'/customer/fleet':role==='Broker'?'/broker/fleet':'/admin/vehicles'");
    expect(nav).toContain('if(authenticated && i===6)');
    expect(nav).toContain("role==='Customer'?'/customer/drivers':role==='Broker'?'/broker/drivers':'/admin/drivers'");
    for(const file of ['app/customer/fleet/page.tsx','app/customer/drivers/page.tsx','app/broker/fleet/page.tsx','app/broker/drivers/page.tsx']){
      expect(read(file)).toContain('MemberFleetOverview');
    }
  });
  it('backend requires verified active company membership and never trusts arbitrary company data',()=>{
    expect(api).toContain('getBearerToken(request)');
    expect(api).toContain('supabaseAdmin.auth.getUser(token)');
    expect(api).toContain(".from('company_memberships')");
    expect(api).toContain(".eq('user_id', auth.user.id)");
    expect(api).toContain(".eq('company_id', companyId)");
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain('if (!membership) return respond(403');
    expect(api).toContain(".from('vehicles')");
    expect(api).toContain(".from('drivers')");
    expect(api).not.toContain('phone,');
    expect(api).not.toContain('email,');
    expect(api).not.toContain('home_address');
  });
  it('frontend binds active company and suppresses misleading zero on missing partial data',()=>{
    expect(ui).toContain('useCompanyWorkspaceData()');
    expect(ui).toContain('encodeURIComponent(companyId)');
    expect(ui).toContain("Authorization:`Bearer ${token}`");
    expect(ui).toContain("body?.companyId!==companyId");
    expect(ui).toContain('activeFleet.limited === true');
    expect(ui).toContain('fleet?.companyId === companyId');
    expect(ui + read('app/components/workspace/Master3150RealFleetBoard.tsx')).toContain("'Unavailable'");
  });
  it('does not allow Broker pages to bypass broker role gate',()=>{
    expect(read('app/broker/fleet/page.tsx')).toContain("allowedRoles={['broker']}");
    expect(read('app/broker/drivers/page.tsx')).toContain("allowedRoles={['broker']}");
  });
});
