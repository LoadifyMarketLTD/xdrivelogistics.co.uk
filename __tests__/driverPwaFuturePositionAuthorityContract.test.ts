import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
const read=(f:string)=>readFileSync(resolve(process.cwd(),f),'utf8');
const future=read('driver-pwa-reserve/src/FuturePositionPwa.tsx');
const more=read('driver-pwa-reserve/src/OriginalMorePwa.tsx');
const server=read('app/api/driver/future-position/route.ts');
describe('Future Position PWA publishing authority',()=>{
 it('requires driver review and explicit confirmation before server write',()=>{
   expect(future).toContain('event.preventDefault();');
   expect(future).toContain('setReview(true)');
   expect(future).toContain('Confirm and save');
   expect(future).toContain('onClick={()=>void submit()}');
 });
 it('rejects missing or past date and sends only own future position through authorised route',()=>{
   expect(future).toContain('new Date(date).getTime()<=Date.now()');
   expect(future).toContain("method:'PUT',headers:{Authorization:'Bearer '+token");
   expect(future).toContain("'/driver/future-position'");
   expect(server).toContain('requireActiveWebDriver(request)');
   expect(server).toContain(".eq('user_id', driver.userId)");
   expect(server).toContain(".eq('id', driver.driverId)");
 });
 it('confirms only successful server writes, never local-only saves',()=>{
   expect(future).toContain('if(!response.ok||!result.driver)throw Error');
   expect(future).toContain('Future position saved and confirmed by XDrive.');
   expect(more).toContain('case \'future\':return <FuturePositionPwa token={token} driver={driver}/>');
 });
});
