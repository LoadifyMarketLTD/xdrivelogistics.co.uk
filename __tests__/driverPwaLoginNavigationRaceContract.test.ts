import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
const source=readFileSync(resolve(process.cwd(),'driver-pwa-reserve/src/ReserveApp.tsx'),'utf8');
describe('Driver PWA sign-in navigation race protection',()=>{
 it('does not force Loads after late initial live feed, preserving user navigation to More',()=>{
  const login=source.slice(source.indexOf('async function signIn('),source.indexOf('function open(',source.indexOf('async function signIn(')));
  expect(login).toContain('setVerifiedSession(true);await fetchJobs(s.token)');
  expect(login).not.toContain("setTab('Loads')");
  expect(login).not.toContain("setView('list')");
 });
 it('resets More menu when the bottom More tab is clicked again',()=>{
  expect(source).toContain('setMoreNavigationKey(value=>value+1)');
  expect(source).toContain('key={moreNavigationKey} token={session.token}');
 });
});