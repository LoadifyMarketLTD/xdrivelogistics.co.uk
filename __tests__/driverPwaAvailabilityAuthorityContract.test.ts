import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>readFileSync(resolve(process.cwd(),file),'utf8');
const ui=read('driver-pwa-reserve/src/AvailabilityStatusPwa.tsx');
const more=read('driver-pwa-reserve/src/OriginalMorePwa.tsx');
const api=read('app/api/driver/availability-profile/route.ts');
describe('Driver PWA availability authority and explicit confirmation',()=>{
 it('loads actual server state, refusing unknown statuses',()=>{
   expect(ui).toContain("method:'GET',headers:{Authorization:'Bearer '+token}");
   expect(ui).toContain("if(!state)throw Error('The server returned an unrecognised availability status.')");
   expect(ui).toContain("const [current,setCurrent]=useState<Availability|null>(null)");
 });
 it('only writes after explicit review and confirmation, never on selection change',()=>{
   expect(ui).toContain('setReview(true)');
   expect(ui).toContain('Confirm status');
   expect(ui).toContain("method:'PUT',headers:{Authorization:'Bearer '+token");
   expect(ui).toContain('body:JSON.stringify({availabilityStatus:selected})');
   expect(ui).toContain("if(!confirmed||confirmed!==selected)throw Error");
 });
 it('preserves server-owned tenancy and disables public availability when busy or offline',()=>{
   expect(api).toContain('requireActiveWebDriver(request)');
   expect(api).toContain(".eq('user_id', context.userId)");
   expect(api).toContain("if (data.availability_status !== 'available')");
   expect(api).toContain(".from('driver_availability_presence').delete()");
   expect(more).toContain('case \'availability\':return <AvailabilityStatusPwa token={token}/>');
 });
});
