import {describe,it,expect,vi,beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {NextRequest,NextResponse} from 'next/server';
import {isCapabilityAllowedForPath} from '../lib/roleCapabilities';
const {auth,query}=vi.hoisted(()=>({auth:vi.fn(),query:{select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()}}));
vi.mock('../app/api/driver/_lib/webDriverContext',()=>({requireActiveWebDriver:auth,isWebDriverContext:(v:unknown)=>Boolean(v&&typeof v==='object'&&'driverId' in v)}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,supabaseAdmin:{from:()=>query}}));
import {GET} from '../app/api/driver/profile/route';
const context={workspaceRole:'driver' as const,driverId:'driver-1',appAccess:true,driverStatus:'active',accountStatus:'active',companyStatus:'active'};
const paths=['/driver/official-pwa-live','/driver/reserve-pwa/index.html','/driver/reserve-pwa/assets/index-cJA2ZPS5.js','/driver/reserve-pwa/manifest.webmanifest'];
describe('Reserve entrypoint protection',()=>{
 it('allows approved drivers and owner drivers into Reserve',()=>{for(const path of paths){expect(isCapabilityAllowedForPath(path,'driver',context)).toBe(true);expect(isCapabilityAllowedForPath(path,'owner',{...context,workspaceRole:'owner_driver'})).toBe(true);}});
 it('rejects missing and inactive driver identities',()=>{for(const path of paths){expect(isCapabilityAllowedForPath(path,'driver',{...context,driverId:null})).toBe(false);expect(isCapabilityAllowedForPath(path,'driver',{...context,appAccess:false})).toBe(false);expect(isCapabilityAllowedForPath(path,'driver',{...context,driverStatus:'inactive'})).toBe(false);expect(isCapabilityAllowedForPath(path,'driver',{...context,companyStatus:'suspended'})).toBe(false);}});
 it('removes hardcoded Fresh override and preserves forced password route',()=>{const login=readFileSync('app/login/page.tsx','utf8');expect(login).not.toContain('/driver-pwa-fresh/');expect(login).toContain("canonicalRoute === '/driver/official-pwa-live'");expect(login).toContain('mobileDriver || user.mustChangePassword ? canonicalRoute');expect(readFileSync('app/driver/official-pwa-live/page.tsx','utf8')).toContain('/driver/reserve-pwa/index.html');});
});
describe('authenticated GET profile restored',()=>{
 beforeEach(()=>{vi.resetAllMocks();auth.mockResolvedValue({driverId:'driver-1',userId:'user-1',companyId:'company-1',profile:{driver_type:'owner_driver',status:'active',must_change_password:false}});query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.maybeSingle.mockResolvedValue({data:{driver_type:'owner_driver',status:'active',must_change_password:false},error:null});});
 const req=()=>new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/profile');
 it('returns own role and no-store data',async()=>{const response=await GET(req());expect(response.status).toBe(200);expect((await response.json()).driver.driver_type).toBe('owner_driver');expect(auth).toHaveBeenCalledWith(expect.anything(),{includeProfile:true});expect(query.select).not.toHaveBeenCalled();expect(response.headers.get('cache-control')).toBe('private, no-store');});
 it('denies unauthenticated profile before read',async()=>{auth.mockResolvedValue(NextResponse.json({error:'Unauthorized'},{status:401}));expect((await GET(req())).status).toBe(401);expect(query.select).not.toHaveBeenCalled();});
 it('requires initial password change',async()=>{auth.mockResolvedValue({driverId:'driver-1',userId:'user-1',profile:{must_change_password:true}});expect((await GET(req())).status).toBe(403);expect(query.select).not.toHaveBeenCalled();});
});
