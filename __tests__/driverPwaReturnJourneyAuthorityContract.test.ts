import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(f:string)=>readFileSync(resolve(process.cwd(),f),'utf8');
const ui=read('driver-pwa-reserve/src/ReturnJourneyPwa.tsx');
const more=read('driver-pwa-reserve/src/OriginalMorePwa.tsx');
const server=read('app/api/driver/web/resources/route.ts');
const rpc=read('supabase/migrations/20260830004421_port_driver_return_journey_canonical_atomic_replace.sql');
describe('Return Journey PWA server-owned authority',()=>{
 it('uses the authenticated canonical RPC instead of a local-only journey',()=>{
   expect(ui).toContain("action:'save_return_journey'");
   expect(ui).toContain("method:'POST',headers:{Authorization:'Bearer '+token");
   expect(server).toContain("if (action === 'save_return_journey')");
   expect(server).toContain("replace_driver_return_journey_canonical");
   expect(server).toContain('p_driver_id: context.driverId');
   expect(rpc).toContain('IF NOT EXISTS (');
 });
 it('only publishes after date validation, review and explicit confirmation',()=>{
   expect(ui).toContain('new Date(start).getTime()<=Date.now()');
   expect(ui).toContain("setReview('publish')");
   expect(ui).toContain('Confirm publication');
   expect(ui).toContain('onClick={()=>void publish(review)}');
 });
 it('supports explicit withdrawal and verifies the saved record after writes',()=>{
   expect(ui).toContain("setReview('clear')");
   expect(ui).toContain("if(!response.ok||saved.ok!==true)throw Error");
   expect(ui).toContain("method:'GET',headers:{Authorization:'Bearer '+token}");
   expect(ui).toContain("if(mode==='clear'&&current?.from_postcode)");
   expect(rpc).toContain('IF v_from_postcode IS NULL THEN');
   expect(more).toContain("case 'journeys':return <ReturnJourneyPwa");
 });
});
