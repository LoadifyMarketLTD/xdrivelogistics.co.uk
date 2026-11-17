import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { driverRoleFromProfile } from '../driver-pwa-reserve/src/driverRoleFromProfile';

const src=readFileSync('driver-pwa-reserve/src/ReserveApp.tsx','utf8');

describe('Verified XDrive driver role controls invoice access in the PWA',()=>{
 it('resolves the owner-driver profile used by Pixel',()=>{
   expect(driverRoleFromProfile({driver:{driver_type:'owner_driver'}})).toBe('Owner Driver');
 });
 it('resolves a company-driver profile without granting owner UI',()=>{
   expect(driverRoleFromProfile({driver:{driver_type:'company_driver'}})).toBe('Company Driver');
 });
 it('fails closed for unrecognised or missing roles',()=>{
   expect(driverRoleFromProfile({driver:{driver_type:'unknown'}})).toBeNull();
   expect(driverRoleFromProfile({driver:{}})).toBeNull();
   expect(driverRoleFromProfile({})).toBeNull();
   expect(driverRoleFromProfile(null)).toBeNull();
 });
 it('does not discard the successful first profile lookup and request a second that can fail silently',()=>{
   expect(src).toContain("profile=await driverGet('/profile',s.token,7000)");
   expect(src).toContain("const verifiedRole=driverRoleFromProfile(profile)");
   expect(src).not.toContain("void driverGet('/profile',s.token,7000).then(");
   expect(src).not.toContain(".catch(()=>{});await fetchJobs(s.token);");
 });
 it('verifies role for both initial sign-in and manual live refresh',()=>{
   expect((src.match(/driverRoleFromProfile\(await driverGet\('\/profile',s.token,7000\)\)/g)||[]).length).toBe(2);
   expect(src).toContain("if(!verifiedRole)throw new Error('Driver type could not be verified.");
 });
 it('keeps UI invoice access behind both completed POD and owner role',()=>{
   expect(src).toContain("j.podRecorded&&role==='Owner Driver'");
   expect(src).toContain("job.podRecorded&&role==='Owner Driver'");
   expect(src).toContain("role==='Owner Driver'&&<button");
 });
});
