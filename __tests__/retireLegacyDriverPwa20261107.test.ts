import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root='app/driver-pwa-fresh';
function publicRoutes(dir:string):string[]{
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?publicRoutes(path):entry.name==='page.tsx'||entry.name==='route.ts'?[path.replaceAll('\\','/')]:[];
 });
}
describe('retired legacy Driver PWA is no longer routable',()=>{
 it('removes every old Jobs, Quotes, Bookings and demo page',()=>{
  const paths=publicRoutes(root);
  expect(paths).toEqual(['app/driver-pwa-fresh/sw.js/route.ts']);
 });
 it('removes old PWA manifest and installing layout',()=>{
  expect(existsSync(join(root,'layout.tsx'))).toBe(false);
  expect(existsSync(join(root,'manifest.webmanifest','route.ts'))).toBe(false);
 });
 it('routes mobile authenticated drivers to the official PWA',()=>{
  const source=readFileSync('app/driver/MobileDriverWorkspaceRedirect.tsx','utf8');
  expect(source).toContain("router.replace('/driver/official-pwa-live')");
  expect(source).not.toContain("router.replace('/driver-pwa-fresh/bookings')");
 });
 it('retires old installed service worker scope',()=>{
  const source=readFileSync(join(root,'sw.js','route.ts'),'utf8');
  expect(source).toContain('self.registration.unregister()');
  expect(source).toContain('/driver/official-pwa-live');
 });
 it('preserves the approved PWA entry point and booking workflow modules',()=>{
  expect(existsSync('app/driver/official-pwa-live/page.tsx')).toBe(true);
  expect(existsSync('app/driver-pwa-fresh/bookings/[id]/workflow/ProofOfDeliveryStep.tsx')).toBe(true);
 });
});
