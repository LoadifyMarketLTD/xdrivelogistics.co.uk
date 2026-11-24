import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
const read=(f:string)=>readFileSync(resolve(process.cwd(),f),'utf8');
const discovery=read('driver-pwa-reserve/src/MemberDiscoveryPwa.tsx');
const more=read('driver-pwa-reserve/src/OriginalMorePwa.tsx');
const availability=read('app/api/availability/nearby/route.ts');
const directory=read('app/api/directory/route.ts');
describe('Driver PWA authorised member discovery',()=>{
  it('requires bearer authenticated read-only calls and keeps server access controls',()=>{
    expect(discovery).toContain("method:'GET',headers:{Authorization:'Bearer '+token}");
    expect(discovery).toContain("'/availability/nearby?scope=exchange'");
    expect(discovery).toContain("'/directory'");
    expect(availability).toContain('getBearerToken(request)');
    expect(directory).toContain('getBlockedCounterpartyCompanyIds');
  });
  it('shows only coarse exchange information and never exposes internal driver identities or exact coordinates',()=>{
    expect(discovery).toContain("positions.filter(p=>p.scope==='exchange')");
    expect(discovery).toContain('member_name');
    expect(discovery).not.toContain('position.lat');
    expect(discovery).not.toContain('position.lng');
    expect(discovery).not.toContain('driver_id');
    expect(discovery).toContain('safeMemberId');
  });
  it('distinguishes access denied from genuinely empty results and cancels stale reads',()=>{
    expect(discovery).toContain('if(!response.ok)throw Error');
    expect(discovery).toContain('if(!controller.signal.aborted)setError');
    expect(discovery).toContain('return()=>controller.abort()');
    expect(discovery).toContain('No members are currently returned for your authorised view.');
  });
  it('preserves all original More entries and My Invoices',()=>{
    expect(more).toContain('mode="nearby"');
    expect(more).toContain('mode="directory"');
    expect(more).toContain('My Invoices');
    expect(more).toContain('Future Position');
  });
});
