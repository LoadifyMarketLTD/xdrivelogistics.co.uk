import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read=(f:string)=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const master=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
const api=read('app/api/workspace/return-journeys/route.ts');
const page=read('app/components/workspace/MemberReturnJourneysPage.tsx');

describe('Master Return Journeys is an authorised published Exchange feed',()=>{
  it('navigates to real role-specific return journey modules',()=>{
    expect(master).toContain('if(authenticated && i===12)');
    expect(master).toContain("role==='Customer'?'/customer/returns':role==='Broker'?'/broker/returns':'/admin/fleet/returns'");
    expect(read('app/customer/returns/page.tsx')).toContain('MemberReturnJourneysPage');
    expect(read('app/broker/returns/page.tsx')).toContain('MemberReturnJourneysPage');
    expect(read('app/broker/returns/page.tsx')).toContain("allowedRoles={['broker']}");
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('customerMasterTab(pathname)');
    expect(read('lib/masterWorkspaceRouteTab.ts')).toContain('returns:12');
    expect(master).toContain("'/driver/returns'");
  });
  it('server confirms active membership, only advertised active returns, no driver identity or exact addresses',()=>{
    expect(api).toContain('getBearerToken(request)');
    expect(api).toContain('supabaseAdmin.auth.getUser(token)');
    expect(api).toContain(".from('company_memberships')");
    expect(api).toContain(".eq('user_id',auth.user.id).eq('status','active')");
    expect(api).toContain(".in('status',['active','available'])");
    expect(api).toContain('publicOutcode(row.from_postcode)');
    expect(api).toContain('publicOutcode(row.to_postcode)');
    expect(api).not.toContain('driver_id:string');
    expect(api).not.toContain('phone,');
    expect(api).not.toContain('notes:row.notes');
  });
  it('uses real endpoint and preserves error/partial distinctions',()=>{
    expect(page).toContain('/api/workspace/return-journeys');
    expect(page).toContain('supabase.auth.getSession()');
    expect(page).toContain('Authorization:`Bearer ${token}`');
    expect(page).toContain("body?.source!=='published-return-journeys'");
    expect(page).toContain("error||limited?'Unavailable':journeys.length");
    expect(page).toContain('return-journeys.css');
    expect(page).not.toContain('useDemoLoads');
  });
});
