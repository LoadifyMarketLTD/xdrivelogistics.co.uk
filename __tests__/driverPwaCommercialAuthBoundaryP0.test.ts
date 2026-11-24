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
    expect(login.indexOf("driverGet('/profile',s.token,7000)")).toBeGreaterThan(-1);
    expect(login.indexOf("driverGet('/profile',s.token,7000)")).toBeLessThan(login.indexOf('setSession(s)'));
    expect(login.indexOf('setSession(s)')).toBeLessThan(login.indexOf('setVerifiedSession(true)'));
  });
  it('discards an unauthorised session but preserves an already approved session on unrelated feed errors',()=>{
    expect(login).toContain('if(!profileApproved){resetLiveSession();setVerifiedSession(false);setSession(null);localStorage.removeItem(KEY);}');
    expect(login).toContain('profileApproved=true;setVerifiedSession(true);await fetchJobs(s.token)');
  });
});