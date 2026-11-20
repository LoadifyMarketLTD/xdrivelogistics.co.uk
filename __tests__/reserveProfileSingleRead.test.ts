import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const {getUser,from,gate,select,eq,maybeSingle,overrideTypes}=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),gate:vi.fn(),select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(),overrideTypes:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,getBearerToken:()=> 'fixture',supabaseAdmin:{auth:{getUser},from},supabaseValidator:null}));
vi.mock('../app/api/driver/mobile/_deviceSessionGate',()=>({rejectRevokedNativeAuthSession:gate}));
import {GET} from '../app/api/driver/profile/route';
const req=()=>new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/profile');
const row={id:'driver-1',company_id:'company-1',app_access:true,display_name:'Fixture',email:'fixture@example.invalid',phone:null,driver_type:'owner_driver',status:'active',must_change_password:false};
beforeEach(()=>{vi.resetAllMocks();getUser.mockResolvedValue({data:{user:{id:'user-1'}},error:null});from.mockReturnValue({select});select.mockReturnValue({eq});eq.mockReturnValue({maybeSingle});maybeSingle.mockReturnValue({overrideTypes});overrideTypes.mockResolvedValue({data:row,error:null});gate.mockResolvedValue(null);});
describe('single authenticated profile read',()=>{
it('reads exactly once and returns only approved self profile fields',async()=>{const r=await GET(req());expect(r.status).toBe(200);expect(from).toHaveBeenCalledTimes(1);expect(from).toHaveBeenCalledWith('drivers');expect(eq).toHaveBeenCalledWith('user_id','user-1');expect(gate).toHaveBeenCalledWith(expect.anything(),'user-1','driver-1');expect((await r.json()).driver).toEqual({display_name:row.display_name,email:row.email,phone:null,driver_type:row.driver_type,status:row.status,must_change_password:false});expect(r.headers.get('cache-control')).toBe('private, no-store');});
it('rejects unapproved driver',async()=>{overrideTypes.mockResolvedValue({data:{...row,app_access:false},error:null});expect((await GET(req())).status).toBe(403);});
it('rejects revoked device',async()=>{gate.mockResolvedValue(NextResponse.json({error:'revoked'},{status:401}));expect((await GET(req())).status).toBe(401);});
it('forces password change',async()=>{overrideTypes.mockResolvedValue({data:{...row,must_change_password:true},error:null});expect((await GET(req())).status).toBe(403);});
it('rejects invalid auth without querying data',async()=>{getUser.mockResolvedValue({data:{user:null},error:{message:'invalid'}});expect((await GET(req())).status).toBe(401);expect(from).not.toHaveBeenCalled();});
it('fails closed on database error',async()=>{overrideTypes.mockResolvedValue({data:null,error:{message:'failure'}});expect((await GET(req())).status).toBe(500);});
});
