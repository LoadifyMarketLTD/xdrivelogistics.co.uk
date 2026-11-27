import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const src=readFileSync(resolve(process.cwd(),'driver-pwa-reserve/src/ReserveApp.tsx'),'utf8');
const login=src.slice(src.indexOf('async function signIn('),src.indexOf('function open(',src.indexOf('async function signIn(')));

describe('P0 Driver PWA commercial authorization boundary',()=>{
  it('does not treat an unapproved Supabase session as an authorized Driver',()=>{
    expect(src).toContain('const connected=LOCAL||Boolean(session&&verifiedSession);');
    expect(src.indexOf('const [verifiedSession,setVerifiedSession]')).toBeLessThan(src.indexOf('const connected='));
  });
  it('checks the Driver profile before persisting the commercial session',()=>{
    expect(login.indexOf("driverGet('/profile', signedIn.token, 7000)")).toBeGreaterThan(-1);
    expect(login.indexOf("driverGet('/profile', signedIn.token, 7000)")).toBeLessThan(login.indexOf('setSession(signedIn)'));
    expect(login.indexOf('setSession(signedIn)')).toBeLessThan(login.indexOf('setVerifiedSession(true)'));
  });
  it('discards an unauthorised session but preserves an already approved session on unrelated feed errors',()=>{
    expect(login).toContain('if (!profileApproved || isAuthFailure(reason)) clearInvalidSession();');
    expect(login).toContain('profileApproved = true;');
    expect(login.indexOf('profileApproved = true;')).toBeLessThan(login.indexOf('await fetchJobs(signedIn.token)'));
    expect(login.indexOf('if (!verifiedRole) throw')).toBeGreaterThan(-1);
    expect(login.indexOf('if (!verifiedRole) throw')).toBeLessThan(login.indexOf('persistDriverSession(signedIn)'));
    expect(login.indexOf('persistDriverSession(signedIn)')).toBeLessThan(login.indexOf('setVerifiedSession(true)'));
    const cleanup=src.replace(/\r\n/g,'\n').slice(src.replace(/\r\n/g,'\n').indexOf('const clearInvalidSession='),src.replace(/\r\n/g,'\n').indexOf('};'+String.fromCharCode(10),src.replace(/\r\n/g,'\n').indexOf('const clearInvalidSession=')));
    for (const action of ['resetLiveSession()','setVerifiedSession(false)','clearDriverSession()','setSession(null)','feedCache.current.clear()']) expect(cleanup).toContain(action);
  });
});